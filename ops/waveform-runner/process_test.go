package runner

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
)

type processWorker struct {
	cleanup func(context.Context) error
	run     func(context.Context, Payload) (json.RawMessage, error)
}

func (w processWorker) Cleanup(ctx context.Context) error { return w.cleanup(ctx) }
func (w processWorker) Run(ctx context.Context, p Payload) (json.RawMessage, error) {
	return w.run(ctx, p)
}

func TestProcessDeliveryLifecycle(t *testing.T) {
	for _, scenario := range []string{"success", "redelivery", "delete failure", "terminal response lost", "terminal unconfirmed", "old attempt", "start refused", "start response lost", "already terminal", "missing job", "wrong source", "unapproved", "worker failure", "cleanup failure", "worker stalled", "cancelled worker"} {
		t.Run(scenario, func(t *testing.T) {
			var cleanups, runs, starts, submits, gets, deletes atomic.Int32
			var stored atomic.Bool
			stored.Store(scenario == "already terminal")
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			jobs, _ := jobFixture(t, func(w http.ResponseWriter, r *http.Request) {
				switch {
				case r.Method == "GET":
					gets.Add(1)
					if scenario == "missing job" {
						w.WriteHeader(404)
						io.WriteString(w, `{"code":"WAVEFORM_JOB_NOT_FOUND","message":"missing"}`)
						return
					}
					body := jobJSON
					if scenario == "redelivery" {
						body = strings.Replace(strings.Replace(body, `"QUEUED"`, `"RUNNING"`, 1), `"attemptId":null`, `"attemptId":"`+oldAttempt+`"`, 1)
					}
					if scenario == "wrong source" {
						body = strings.Replace(body, payload.VideoID, "lmnopqrstuv", 1)
					}
					if stored.Load() {
						body = strings.Replace(body, `"QUEUED"`, `"SUCCEEDED"`, 1)
					}
					io.WriteString(w, body)
				case strings.HasSuffix(r.URL.Path, "/start"):
					if cleanups.Load() != 1 {
						t.Error("start before cleanup")
					}
					starts.Add(1)
					if scenario == "redelivery" {
						var input struct {
							Expected *string `json:"expectedAttemptId"`
						}
						if json.NewDecoder(r.Body).Decode(&input) != nil || input.Expected == nil || *input.Expected != oldAttempt {
							t.Error("redelivery lost current attempt fence")
						}
					}
					if scenario == "start response lost" {
						disconnect(t, w)
						return
					}
					io.WriteString(w, startJSON("RUNNING", new(nextAttempt), scenario != "start refused"))
				case strings.HasSuffix(r.URL.Path, "/terminal"):
					submits.Add(1)
					if runs.Load() != 1 {
						t.Error("terminal before worker return")
					}
					var input Terminal
					if json.NewDecoder(r.Body).Decode(&input) != nil || input.Status != "SUCCEEDED" || input.AttemptID == nil || *input.AttemptID != nextAttempt {
						t.Error("wrong terminal/attempt")
					}
					if scenario == "terminal unconfirmed" {
						w.WriteHeader(500)
						io.WriteString(w, `{}`)
						return
					}
					if scenario == "old attempt" {
						json.NewEncoder(w).Encode(TerminalAck{payload.JobID, new(oldAttempt), "RUNNING", false})
						return
					}
					stored.Store(true)
					if scenario == "terminal response lost" {
						disconnect(t, w)
						return
					}
					json.NewEncoder(w).Encode(TerminalAck{payload.JobID, new(nextAttempt), "SUCCEEDED", true})
				default:
					t.Error("unexpected Job request")
				}
			})
			c, _ := consumerFixture(t, func(w http.ResponseWriter, r *http.Request) {
				if r.Method == "GET" {
					io.WriteString(w, batch(message()))
					return
				}
				if r.Method != "DELETE" {
					t.Error("unexpected queue request")
					return
				}
				if cleanups.Load() != 1 || !stored.Load() && scenario != "missing job" {
					t.Error("delete before cleanup/terminal")
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
						return errors.New("cleanup failed")
					}
					return nil
				},
				run: func(call context.Context, p Payload) (json.RawMessage, error) {
					runs.Add(1)
					if starts.Load() != 1 || p != payload {
						t.Error("worker before start/wrong source")
					}
					if scenario == "worker stalled" {
						return nil, ErrRunnerStalled
					}
					if scenario == "cancelled worker" {
						cancel()
						return nil, call.Err()
					}
					if scenario == "worker failure" {
						return nil, errors.New("PRIVATE_MARKER")
					}
					return json.RawMessage(`{"durationMs":20,"bucketSizeMs":20,"peaks":{"version":1,"sample_rate":8000,"samples_per_pixel":160,"bits":8,"length":1,"data":[-1,1]},"source":{"type":"youtube","id":"abcdefghijk"},"generationVersion":1}`), nil
				},
			}
			approved := []string{payload.VideoID}
			if scenario == "unapproved" {
				approved = nil
			}
			var err error
			if scenario == "success" {
				err = c.ConsumeOne(ctx, jobs, worker, approved)
			} else {
				err = c.Process(ctx, leaseDelivery(c), jobs, worker, approved)
			}
			success := scenario == "success" || scenario == "redelivery" || scenario == "terminal response lost" || scenario == "already terminal" || scenario == "missing job"
			if (err == nil) != success {
				t.Fatalf("unexpected outcome: %v", err)
			}
			if scenario == "delete failure" && consumeFailureStage(err) != "delete" {
				t.Fatal("delete failure stage missing")
			}
			wantDelete := success || scenario == "delete failure"
			if (deletes.Load() == 1) != wantDelete {
				t.Fatal("unsafe delete decision")
			}
			if scenario == "delete failure" && (!stored.Load() || submits.Load() != 1) {
				t.Fatal("delete failure undid/repeated commit")
			}
			if scenario == "terminal response lost" && (gets.Load() != 2 || submits.Load() != 1) {
				t.Fatal("lost terminal not confirmed by lookup")
			}
			switch scenario {
			case "start refused", "start response lost", "already terminal", "missing job", "wrong source", "unapproved", "cleanup failure":
				if runs.Load() != 0 || submits.Load() != 0 {
					t.Fatal("worker ran without permission")
				}
			case "worker failure", "worker stalled", "cancelled worker":
				if submits.Load() != 0 {
					t.Fatal("failed/cancelled worker submitted terminal")
				}
			}
			if scenario == "cleanup failure" || scenario == "worker stalled" {
				if err != ErrRunnerStalled {
					t.Fatal("cleanup failure not fatal")
				}
				if _, err := c.Poll(context.Background()); err != ErrRunnerStalled {
					t.Fatal("unclean worker allowed another delivery")
				}
			}
		})
	}
}

func disconnect(t *testing.T, w http.ResponseWriter) {
	t.Helper()
	c, _, err := w.(http.Hijacker).Hijack()
	if err != nil {
		t.Error(err)
		return
	}
	c.Close()
}

func TestConsumeEmptyPoll(t *testing.T) {
	c, _ := consumerFixture(t, func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, `{"messages":[]}`) })
	jobs, _ := jobFixture(t, func(http.ResponseWriter, *http.Request) { t.Error("empty poll touched Job") })
	worker := processWorker{cleanup: func(context.Context) error { t.Error("empty poll touched worker"); return nil }}
	if err := c.ConsumeOne(context.Background(), jobs, worker, nil); err != nil {
		t.Fatal(err)
	}
}
