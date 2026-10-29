package runner

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestTerminalConfirmation(t *testing.T) {
	for _, status := range []string{"SUCCEEDED", "FAILED"} {
		client, count := jobFixture(t, func(w http.ResponseWriter, r *http.Request) {
			var body Terminal
			if json.NewDecoder(r.Body).Decode(&body) != nil || body.JobID != payload.JobID || body.AttemptID == nil || *body.AttemptID != oldAttempt || r.URL.Path != jobPath+payload.JobID+"/terminal" || r.Method != "POST" {
				t.Error("invalid terminal request")
			}
			json.NewEncoder(w).Encode(TerminalAck{payload.JobID, new(oldAttempt), status, true})
		})
		ack, err := client.Complete(context.Background(), Terminal{JobID: payload.JobID, AttemptID: new(oldAttempt), Status: "SUCCEEDED", Result: json.RawMessage(`{"durationMs":20,"bucketSizeMs":20,"peaks":{"version":1,"sample_rate":8000,"samples_per_pixel":160,"bits":8,"length":1,"data":[-1,1]},"source":{"type":"youtube","id":"abcdefghijk"},"generationVersion":1}`)})
		if err != nil || !ack.Applied || ack.Status != status || count.Load() != 1 {
			t.Fatal("authoritative terminal not preserved", err)
		}
	}
}

func TestTerminalOldAttemptProjection(t *testing.T) {
	for _, status := range []string{"QUEUED", "RUNNING", "SUCCEEDED", "FAILED"} {
		client, count := jobFixture(t, func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(TerminalAck{payload.JobID, new(nextAttempt), status, false})
		})
		ack, err := client.Complete(context.Background(), Terminal{JobID: payload.JobID, AttemptID: new(oldAttempt), Status: "FAILED", ErrorCode: "PROCESSING_FAILED"})
		if err != nil || ack.Applied || ack.Status != status || *ack.AttemptID != nextAttempt || count.Load() != 1 {
			t.Fatal("old attempt projection lost", err)
		}
	}
}

func TestTerminalRejectsBrokenAck(t *testing.T) {
	valid := `{"jobId":"` + payload.JobID + `","attemptId":null,"status":"FAILED","applied":true}`
	for _, body := range []string{`null`, valid + `{}`, strings.Replace(valid, `"applied":true`, `"applied":null`, 1), strings.Replace(valid, `"applied":true`, `"Applied":true`, 1), strings.Replace(valid, `"FAILED"`, `"RUNNING"`, 1), strings.Replace(valid, `"FAILED"`, `"SUCCEEDED"`, 1), strings.Replace(valid, payload.JobID, payload.SongID, 1), strings.Replace(valid, `"attemptId":null,`, ``, 1), strings.Replace(valid, `"attemptId":null`, `"attemptId":"`+oldAttempt+`"`, 1), strings.Repeat(" ", maxPublishResponse+1)} {
		client, count := jobFixture(t, func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, body) })
		ack, err := client.Complete(context.Background(), Terminal{JobID: payload.JobID, Status: "FAILED", ErrorCode: "DLQ"})
		if err != ErrJobAPI || ack != (TerminalAck{}) || count.Load() != 1 {
			t.Fatal("invalid ACK accepted")
		}
	}
}

func TestTerminalResponseLossDoesNotRetry(t *testing.T) {
	client, count := jobFixture(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" {
			io.Copy(io.Discard, r.Body)
			c, _, err := w.(http.Hijacker).Hijack()
			if err != nil {
				t.Error(err)
				return
			}
			c.Close()
			return
		}
		io.WriteString(w, strings.Replace(jobJSON, `"QUEUED"`, `"FAILED"`, 1))
	})
	ack, err := client.Complete(context.Background(), Terminal{JobID: payload.JobID, Status: "FAILED", ErrorCode: "DLQ"})
	if err != ErrJobAPI || ack != (TerminalAck{}) || count.Load() != 1 {
		t.Fatal("uncertain commit retried")
	}
	job, err := client.Get(context.Background(), payload.JobID)
	if err != nil || job.Status != "FAILED" || count.Load() != 2 {
		t.Fatal("commit lookup failed")
	}
}

func TestTerminalInputLimits(t *testing.T) {
	client, count := jobFixture(t, func(http.ResponseWriter, *http.Request) { t.Error("invalid input sent") })
	for _, value := range []Terminal{
		{JobID: "bad", Status: "FAILED", ErrorCode: "DLQ"},
		{JobID: payload.JobID, Status: "RUNNING"},
		{JobID: payload.JobID, Status: "FAILED", ErrorCode: "PRIVATE_MARKER"},
		{JobID: payload.JobID, Status: "SUCCEEDED", Result: json.RawMessage(`{}`)},
		{JobID: payload.JobID, AttemptID: new(oldAttempt), Status: "SUCCEEDED", Result: json.RawMessage(`null`)},
		{JobID: payload.JobID, AttemptID: new(oldAttempt), Status: "SUCCEEDED", Result: json.RawMessage(`{"padding":"` + strings.Repeat("a", maxTerminalBody-14) + `"}`)},
		{JobID: payload.JobID, Status: "FAILED", ErrorCode: "DLQ", Result: json.RawMessage(`{}`)},
	} {
		if _, err := client.Complete(context.Background(), value); err != ErrPayload {
			t.Fatal("invalid terminal accepted")
		}
	}
	if count.Load() != 0 {
		t.Fatal("invalid input reached HTTP")
	}
}
