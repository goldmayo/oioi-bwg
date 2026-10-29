package runner

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

const oldAttempt = "019a0170-0000-7000-8000-000000000003"
const nextAttempt = "019a0170-0000-7000-8000-000000000004"

func startJSON(status string, attempt *string, started bool) string {
	var fields map[string]any
	json.Unmarshal([]byte(jobJSON), &fields)
	fields["status"], fields["attemptId"], fields["started"] = status, attempt, started
	data, _ := json.Marshal(fields)
	return string(data)
}

func TestJobStartConfirmed(t *testing.T) {
	for _, expected := range []*string{nil, new(oldAttempt)} {
		t.Run("compare expected attempt", func(t *testing.T) {
			client, count := jobFixture(t, func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodPost || r.URL.Path != jobPath+payload.JobID+"/start" || r.URL.RawQuery != "" || r.Header.Get("Content-Type") != "application/json" {
					t.Error("unexpected start request")
				}
				var fields map[string]json.RawMessage
				body, _ := io.ReadAll(r.Body)
				json.Unmarshal(body, &fields)
				want, _ := json.Marshal(struct {
					Payload
					Expected *string `json:"expectedAttemptId"`
				}{payload, expected})
				if string(body) != string(want) || len(fields) != 4 || len(body) > 1024 {
					t.Error("identifiers/required nullable attempt violated")
				}
				io.WriteString(w, startJSON("RUNNING", new(nextAttempt), true))
			})
			ack, err := client.Start(context.Background(), payload, expected)
			if err != nil || !ack.Started || ack.Status != "RUNNING" || ack.AttemptID == nil || *ack.AttemptID != nextAttempt || ack.EnqueuedAt != nil || count.Load() != 1 {
				t.Fatalf("start not confirmed: %+v %v", ack, err)
			}
		})
	}
}

func TestJobStartFalseNeverAuthorizesExecution(t *testing.T) {
	for _, status := range []string{"QUEUED", "RUNNING", "SUCCEEDED", "FAILED"} {
		t.Run(status, func(t *testing.T) {
			client, count := jobFixture(t, func(w http.ResponseWriter, r *http.Request) {
				io.WriteString(w, startJSON(status, new(nextAttempt), false))
			})
			ack, err := client.Start(context.Background(), payload, new(oldAttempt))
			if err != nil || ack.Started || ack.Status != status || count.Load() != 1 {
				t.Fatal("unchanged projection treated as start/retried")
			}
		})
	}
}

func TestJobStartRejectsUnsafeAcknowledgement(t *testing.T) {
	valid := startJSON("RUNNING", new(nextAttempt), true)
	for name, body := range map[string]string{
		"missing started":  strings.Replace(valid, `"started":true,`, "", 1),
		"null started":     strings.Replace(valid, `"started":true`, `"started":null`, 1),
		"string started":   strings.Replace(valid, `"started":true`, `"started":"true"`, 1),
		"case variant":     strings.Replace(valid, `"started":true`, `"Started":true`, 1),
		"case override":    strings.Replace(valid, `"started":true`, `"started":false,"Started":true`, 1),
		"case job field":   strings.Replace(valid, `"id":`, `"ID":`, 1),
		"null attempt":     startJSON("RUNNING", nil, true),
		"same attempt":     startJSON("RUNNING", new(oldAttempt), true),
		"queued":           startJSON("QUEUED", new(nextAttempt), true),
		"succeeded":        startJSON("SUCCEEDED", new(nextAttempt), true),
		"failed":           startJSON("FAILED", new(nextAttempt), true),
		"other job":        strings.Replace(valid, payload.JobID, oldAttempt, 1),
		"other song":       strings.Replace(valid, payload.SongID, oldAttempt, 1),
		"other video":      strings.Replace(valid, payload.VideoID, "lmnopqrstuv", 1),
		"missing nullable": strings.Replace(valid, `"enqueuedAt":null,`, "", 1),
		"bad attempt":      strings.Replace(valid, nextAttempt, "bad", 1),
		"extra field":      strings.Replace(valid, `"started":true`, `"started":true,"command":"bad"`, 1),
		"trailing JSON":    valid + `{}`,
		"oversize":         strings.Repeat(" ", maxPublishResponse+1),
	} {
		t.Run(name, func(t *testing.T) {
			client, count := jobFixture(t, func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, body) })
			ack, err := client.Start(context.Background(), payload, new(oldAttempt))
			if err != ErrJobAPI || ack != (StartAck{}) || count.Load() != 1 {
				t.Fatal("unsafe ACK authorized execution/retried")
			}
		})
	}
}

func TestJobStartResponseLossRequiresLookup(t *testing.T) {
	client, count := jobFixture(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			io.Copy(io.Discard, r.Body)
			connection, _, err := w.(http.Hijacker).Hijack()
			if err != nil {
				t.Error(err)
				return
			}
			connection.Close()
			return
		}
		io.WriteString(w, strings.Replace(startJSON("RUNNING", new(nextAttempt), true), `"started":true,`, "", 1))
	})
	ack, err := client.Start(context.Background(), payload, nil)
	if err != ErrJobAPI || ack != (StartAck{}) || count.Load() != 1 {
		t.Fatal("lost start retried/authorized")
	}
	job, err := client.Get(context.Background(), payload.JobID)
	if err != nil || job.Status != "RUNNING" || job.AttemptID == nil || *job.AttemptID != nextAttempt || count.Load() != 2 {
		t.Fatal("lost response cannot be checked without another start")
	}
}

func TestJobStartFailureAndCancellation(t *testing.T) {
	for _, status := range []int{403, 404, 500, 307} {
		client, count := jobFixture(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(status)
			io.WriteString(w, `{"code":"PRIVATE_MARKER","message":"PRIVATE_MARKER"}`)
		})
		ack, err := client.Start(context.Background(), payload, nil)
		if err != ErrJobAPI || ack != (StartAck{}) || count.Load() != 1 {
			t.Fatal("HTTP failure authorized/retried/leaked response")
		}
	}
	client, count := jobFixture(t, func(http.ResponseWriter, *http.Request) { t.Error("cancelled request sent") })
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if ack, err := client.Start(ctx, payload, nil); err != ErrJobAPI || ack != (StartAck{}) || count.Load() != 0 {
		t.Fatal("cancelled start authorized/sent")
	}
}

func TestJobStartInvalidInput(t *testing.T) {
	client, count := jobFixture(t, func(http.ResponseWriter, *http.Request) { t.Error("invalid input sent") })
	for _, value := range []Payload{
		{JobID: "../bad", SongID: payload.SongID, VideoID: payload.VideoID},
		{JobID: payload.JobID, SongID: "bad", VideoID: payload.VideoID},
		{JobID: payload.JobID, SongID: payload.SongID, VideoID: "https://example.invalid"},
	} {
		if ack, err := client.Start(context.Background(), value, nil); err != ErrPayload || ack != (StartAck{}) {
			t.Fatal("invalid source/identifiers accepted")
		}
	}
	if _, err := client.Start(context.Background(), payload, new("bad")); err != ErrPayload || count.Load() != 0 {
		t.Fatal("invalid attempt sent")
	}
}
