package runner

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

const jobJSON = `{"id":"019a0170-0000-7000-8000-000000000001","songId":"019a0170-0000-7000-8000-000000000002","videoId":"abcdefghijk","status":"QUEUED","attemptId":null,"enqueuedAt":null}`

var fixtureToken = strings.Repeat("b", 64)

func jobFixture(t *testing.T, handler http.HandlerFunc) (*JobClient, *atomic.Int32) {
	t.Helper()
	count := &atomic.Int32{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count.Add(1)
		if r.Header.Get("Authorization") != "Bearer "+fixtureToken || r.Header.Get("Cookie") != "" || r.Header.Get("Origin") != "" {
			t.Error("invalid service authentication")
		}
		w.Header().Set("Content-Type", "application/json")
		handler(w, r)
	}))
	t.Cleanup(server.Close)
	client, err := NewJobClient(server.Listener.Addr().(*net.TCPAddr).Port, fixtureToken)
	if err != nil {
		t.Fatal(err)
	}
	return client, count
}

func TestJobGetAndRecord(t *testing.T) {
	first := "2026-10-29T00:00:00Z"
	client, count := jobFixture(t, func(w http.ResponseWriter, r *http.Request) {
		expectedPath := jobPath + payload.JobID
		result := jobJSON
		if r.Method == http.MethodPost {
			expectedPath += "/enqueued"
			body, _ := io.ReadAll(r.Body)
			expected := `{"jobId":"019a0170-0000-7000-8000-000000000001","songId":"019a0170-0000-7000-8000-000000000002","videoId":"abcdefghijk","enqueuedAt":"2026-10-29T00:00:01Z"}`
			if string(body) != expected || r.Header.Get("Content-Type") != "application/json" {
				t.Error("invalid confirmation payload")
			}
			result = strings.ReplaceAll(result, `"enqueuedAt":null`, `"enqueuedAt":"`+first+`"`)
			result = strings.ReplaceAll(result, `"QUEUED"`, `"SUCCEEDED"`)
		} else if r.Method != http.MethodGet {
			t.Error("unexpected method")
		}
		if r.URL.Path != expectedPath || r.URL.RawQuery != "" {
			t.Error("unexpected path")
		}
		io.WriteString(w, result)
	})
	job, err := client.Get(context.Background(), payload.JobID)
	if err != nil || job.Status != "QUEUED" || job.EnqueuedAt != nil {
		t.Fatal("null enqueuedAt rejected")
	}
	job, err = client.RecordEnqueued(context.Background(), payload, time.Date(2026, 10, 29, 0, 0, 1, 0, time.UTC))
	if err != nil || job.Status != "SUCCEEDED" || job.EnqueuedAt == nil || *job.EnqueuedAt != first {
		t.Fatal("late confirmation/first timestamp rejected")
	}
	if count.Load() != 2 {
		t.Fatal("unexpected request count")
	}
}

func TestJobResponseValidation(t *testing.T) {
	for _, body := range []string{
		`{`, `null`, jobJSON + `{}`,
		strings.Replace(jobJSON, payload.JobID, payload.SongID, 1),
		strings.Replace(jobJSON, `"QUEUED"`, `"UNKNOWN"`, 1),
		strings.Replace(jobJSON, `"attemptId":null,`, ``, 1),
		strings.Replace(jobJSON, `,"enqueuedAt":null`, ``, 1),
		strings.Replace(jobJSON, `"attemptId":null`, `"attemptId":"bad"`, 1),
		strings.Replace(jobJSON, `"enqueuedAt":null`, `"enqueuedAt":"bad"`, 1),
		strings.Replace(jobJSON, `"status":`, `"command":"bad","status":`, 1),
		strings.Repeat(" ", maxPublishResponse+1),
	} {
		t.Run("invalid DTO", func(t *testing.T) {
			client, count := jobFixture(t, func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, body) })
			if _, err := client.Get(context.Background(), payload.JobID); err != ErrJobAPI {
				t.Fatal("invalid DTO accepted")
			}
			if count.Load() != 1 {
				t.Fatal("unexpected retry")
			}
		})
	}
}

func TestJobOnlySpecific404IsAbsence(t *testing.T) {
	for _, c := range []struct {
		status int
		body   string
		absent bool
	}{
		{404, `{"code":"WAVEFORM_JOB_NOT_FOUND","message":"missing"}`, true},
		{404, `{"code":"NOT_FOUND","message":"PRIVATE_MARKER"}`, false},
		{404, `{"code":"WAVEFORM_JOB_NOT_FOUND"}`, false},
		{403, `{"code":"FORBIDDEN","message":"PRIVATE_MARKER"}`, false},
		{500, `{"code":"INTERNAL_SERVER_ERROR","message":"PRIVATE_MARKER"}`, false},
		{307, `{}`, false},
	} {
		t.Run("status", func(t *testing.T) {
			client, count := jobFixture(t, func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Location", "http://127.0.0.1:1/forbidden")
				w.WriteHeader(c.status)
				io.WriteString(w, c.body)
			})
			_, err := client.Get(context.Background(), payload.JobID)
			if c.absent && err != ErrJobNotFound || !c.absent && err != ErrJobAPI {
				t.Fatalf("unsafe status: %v", err)
			}
			if count.Load() != 1 {
				t.Fatal("retry/redirect followed")
			}
		})
	}
}

func TestJobRecordUnconfirmed(t *testing.T) {
	for _, body := range []string{jobJSON, strings.ReplaceAll(jobJSON, payload.VideoID, "lmnopqrstuv")} {
		client, _ := jobFixture(t, func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, body) })
		if _, err := client.RecordEnqueued(context.Background(), payload, time.Now()); err != ErrJobAPI {
			t.Fatal("unconfirmed record accepted")
		}
	}
	client, count := jobFixture(t, func(w http.ResponseWriter, r *http.Request) {
		io.Copy(io.Discard, r.Body)
		connection, _, err := w.(http.Hijacker).Hijack()
		if err != nil {
			t.Error(err)
			return
		}
		connection.Close()
	})
	if _, err := client.RecordEnqueued(context.Background(), payload, time.Now()); err != ErrJobAPI || count.Load() != 1 {
		t.Fatal("response loss retried")
	}
}

func TestJobSlowBodyDeadline(t *testing.T) {
	client, count := jobFixture(t, func(w http.ResponseWriter, r *http.Request) {
		ticker := time.NewTicker(50 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-r.Context().Done():
				return
			case <-ticker.C:
				io.WriteString(w, " ")
				w.(http.Flusher).Flush()
			}
		}
	})
	started := time.Now()
	if _, err := client.Get(context.Background(), payload.JobID); err != ErrJobAPI {
		t.Fatal(err)
	}
	if time.Since(started) > 3*time.Second || count.Load() != 1 {
		t.Fatal("deadline/retry violated")
	}
}

func TestJobInvalidConfigurationAndInput(t *testing.T) {
	for _, port := range []int{0, -1, 65536} {
		if _, err := NewJobClient(port, fixtureToken); err != ErrConfiguration {
			t.Fatal("port accepted")
		}
	}
	for _, token := range []string{"", "bad", strings.Repeat("B", 64)} {
		if _, err := NewJobClient(3001, token); err != ErrConfiguration {
			t.Fatal("token accepted")
		}
	}
	client, count := jobFixture(t, func(http.ResponseWriter, *http.Request) { t.Error("invalid input sent") })
	if _, err := client.Get(context.Background(), "../bad"); err != ErrPayload {
		t.Fatal(err)
	}
	if _, err := client.RecordEnqueued(context.Background(), payload, time.Time{}); err != ErrPayload {
		t.Fatal(err)
	}
	if count.Load() != 0 {
		t.Fatal("invalid input sent")
	}
}

func TestJobRedirectDoesNotForwardToken(t *testing.T) {
	forwarded := &atomic.Int32{}
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		forwarded.Add(1)
		io.WriteString(w, jobJSON)
	}))
	defer target.Close()
	client, count := jobFixture(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Location", target.URL)
		w.WriteHeader(http.StatusTemporaryRedirect)
		io.WriteString(w, `{}`)
	})
	if _, err := client.Get(context.Background(), payload.JobID); err != ErrJobAPI {
		t.Fatal(err)
	}
	if count.Load() != 1 || forwarded.Load() != 0 {
		t.Fatal("redirect forwarded service token")
	}
}
