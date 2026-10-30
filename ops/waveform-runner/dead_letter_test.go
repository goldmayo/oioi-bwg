package runner

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
)

func TestDeadLetterLifecycle(t *testing.T) {
	for _, scenario := range []string{"queued", "running", "terminal", "missing", "wrong source", "cleanup failure", "response lost", "unconfirmed", "old attempt", "delete failure", "normal delivery", "cancelled"} {
		t.Run(scenario, func(t *testing.T) {
			var cleanups, submits, deletes, gets atomic.Int32
			var stored atomic.Bool
			stored.Store(scenario == "terminal")
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			jobs, _ := jobFixture(t, func(w http.ResponseWriter, r *http.Request) {
				if r.Method == "GET" {
					gets.Add(1)
					if scenario == "missing" {
						w.WriteHeader(404)
						io.WriteString(w, `{"code":"WAVEFORM_JOB_NOT_FOUND","message":"missing"}`)
						return
					}
					body := jobJSON
					if scenario == "running" || scenario == "old attempt" {
						body = strings.Replace(strings.Replace(body, `"QUEUED"`, `"RUNNING"`, 1), `"attemptId":null`, `"attemptId":"`+oldAttempt+`"`, 1)
					}
					if scenario == "wrong source" {
						body = strings.Replace(body, payload.VideoID, "lmnopqrstuv", 1)
					}
					if stored.Load() {
						body = strings.Replace(body, `"QUEUED"`, `"SUCCEEDED"`, 1)
					}
					io.WriteString(w, body)
					return
				}
				if !strings.HasSuffix(r.URL.Path, "/terminal") {
					t.Error("DLQ started attempt")
					return
				}
				submits.Add(1)
				var input Terminal
				if json.NewDecoder(r.Body).Decode(&input) != nil || input.JobID != payload.JobID || input.Status != "FAILED" || input.ErrorCode != "DLQ" || len(input.Result) != 0 || cleanups.Load() != 1 {
					t.Error("unsafe DLQ terminal")
				}
				if scenario == "running" || scenario == "old attempt" {
					if input.AttemptID == nil || *input.AttemptID != oldAttempt {
						t.Error("lost current attempt fence")
					}
				} else if input.AttemptID != nil {
					t.Error("invented attempt")
				}
				if scenario == "unconfirmed" {
					w.WriteHeader(500)
					io.WriteString(w, `{}`)
					return
				}
				if scenario == "old attempt" {
					json.NewEncoder(w).Encode(TerminalAck{payload.JobID, new(nextAttempt), "RUNNING", false})
					return
				}
				stored.Store(true)
				if scenario == "response lost" {
					disconnect(t, w)
					return
				}
				json.NewEncoder(w).Encode(TerminalAck{payload.JobID, input.AttemptID, "FAILED", true})
			})
			c, _ := consumerFixture(t, func(w http.ResponseWriter, r *http.Request) {
				path := "/20210201/queues/" + fixtureQueue + "-dlq/messages"
				if r.Method == "GET" {
					if r.URL.Path != path || r.URL.Query().Encode() != "limit=1&timeoutInSeconds=0&visibilityInSeconds=180" {
						t.Error("wrong DLQ destination")
					}
					io.WriteString(w, batch(message()))
					return
				}
				if r.Method != "DELETE" || r.URL.Path != path+"/"+testReceipt {
					t.Error("wrong DLQ delete")
					return
				}
				if !stored.Load() && scenario != "missing" {
					t.Error("deleted before terminal confirmation")
				}
				deletes.Add(1)
				if scenario == "delete failure" {
					w.WriteHeader(500)
					io.WriteString(w, `{}`)
					return
				}
				w.WriteHeader(204)
			})
			worker := processWorker{
				cleanup: func(context.Context) error {
					cleanups.Add(1)
					if scenario == "cleanup failure" {
						return ErrRunnerStalled
					}
					if scenario == "cancelled" {
						cancel()
					}
					return nil
				},
				run: func(context.Context, Payload) (json.RawMessage, error) {
					t.Error("DLQ ran analysis")
					return nil, ErrWorkUnconfirmed
				},
			}
			var err error
			if scenario == "normal delivery" {
				err = c.ProcessDeadLetter(ctx, leaseDelivery(c), jobs, worker)
			} else {
				err = c.ConsumeDeadLetterOne(ctx, jobs, worker)
			}
			success := scenario == "queued" || scenario == "running" || scenario == "terminal" || scenario == "missing" || scenario == "response lost"
			if (err == nil) != success {
				t.Fatalf("outcome: %v", err)
			}
			if (deletes.Load() == 1) != (success || scenario == "delete failure") {
				t.Fatal("unsafe delete decision")
			}
			if scenario == "response lost" && (gets.Load() != 2 || submits.Load() != 1) {
				t.Fatal("lost ACK not confirmed")
			}
			if scenario == "delete failure" && (!stored.Load() || submits.Load() != 1) {
				t.Fatal("delete failure repeated terminal")
			}
			switch scenario {
			case "terminal", "missing", "wrong source", "cleanup failure", "normal delivery", "cancelled":
				if submits.Load() != 0 {
					t.Fatal("unexpected failure submission")
				}
			}
			if scenario == "cleanup failure" {
				if _, e := c.PollDLQ(ctx); e != ErrRunnerStalled {
					t.Fatal("cleanup uncertainty did not quarantine")
				}
			}
		})
	}
}

func TestDeadLetterLeaseDestinationAndSlot(t *testing.T) {
	c, _ := consumerFixture(t, func(w http.ResponseWriter, r *http.Request) {
		path := "/20210201/queues/" + fixtureQueue + "-dlq/messages"
		if r.Method == "GET" {
			if r.URL.Path != path {
				t.Error("poll destination")
			}
			io.WriteString(w, batch(message()))
			return
		}
		if r.Method != "PUT" || r.URL.Path != path+"/"+testReceipt {
			t.Error("renew destination")
		}
		io.WriteString(w, `{"id":123,"visibleAfter":"2099-01-01T00:00:00Z"}`)
	})
	d, err := c.PollDLQ(context.Background())
	if err != nil || d == nil {
		t.Fatal(err)
	}
	if _, err = c.Renew(context.Background(), d); err != nil {
		t.Fatal(err)
	}
	if err = c.RunWithLease(context.Background(), d, func(ctx context.Context) error {
		if _, e := c.Poll(ctx); e == nil {
			t.Error("normal poll during DLQ")
		}
		if _, e := c.PollDLQ(ctx); e == nil {
			t.Error("DLQ poll during DLQ")
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	// 일반 분석 경로가 DLQ receipt를 실행 권한으로 취급하지 않는다.
	jobs, _ := jobFixture(t, func(http.ResponseWriter, *http.Request) { t.Error("wrong route touched Job") })
	if err = c.Process(context.Background(), d, jobs, processWorker{}, nil); err != ErrConfiguration {
		t.Fatal(err)
	}
}
