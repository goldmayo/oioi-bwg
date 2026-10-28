package runner

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"sync"
	"time"
)

type enqueueAck struct {
	JobID   string `json:"jobId"`
	Outcome string `json:"outcome"`
}

// root는 서비스 수명이다. socket 응답 유실 후에도 제한된 전달 확인을 계속한다.
// 실제 listener/소유 그룹·host lock은 별도 시작/설치 경로가 구성한다.
func NewEnqueueServer(root context.Context, jobs *JobClient, publisher *Publisher, approved []string) *http.Server {
	allowed := make(map[string]bool, len(approved))
	for _, id := range approved {
		if !videoID.MatchString(id) {
			allowed = nil
			break
		}
		allowed[id] = true
	}
	slots := make(chan struct{}, 8)
	// 진행 중 중복만 막는다. 미확인 Job의 재송신은 Console의 새 Job 소유권 계약으로 금지한다.
	var active sync.Map
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		local, ok := r.Context().Value(http.LocalAddrContextKey).(net.Addr)
		if !ok || local.Network() != "unix" || len(r.Header.Values("Origin")) != 0 {
			http.Error(w, "FORBIDDEN", 403)
			return
		}
		if r.URL.Path != "/enqueue" || r.URL.RawQuery != "" {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "METHOD_NOT_ALLOWED", 405)
			return
		}
		select {
		case slots <- struct{}{}:
			defer func() { <-slots }()
		default:
			http.Error(w, "BUSY", 503)
			return
		}
		media, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil || media != "application/json" || r.Header.Get("Content-Encoding") != "" {
			http.Error(w, "INVALID_CONTENT_TYPE", 415)
			return
		}
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1024))
		if err != nil {
			http.Error(w, "INVALID_BODY", 400)
			return
		}
		var fields map[string]json.RawMessage
		var value Payload
		if json.Unmarshal(body, &fields) != nil || len(fields) != 3 || fields["jobId"] == nil || fields["songId"] == nil || fields["videoId"] == nil || json.Unmarshal(body, &value) != nil || !uuid7.MatchString(value.JobID) || !uuid7.MatchString(value.SongID) || !videoID.MatchString(value.VideoID) {
			http.Error(w, "INVALID_PAYLOAD", 400)
			return
		}
		outcome := "UNCONFIRMED"
		if _, duplicate := active.LoadOrStore(value.JobID, struct{}{}); !duplicate {
			defer active.Delete(value.JobID)
			ctx, cancel := context.WithTimeout(root, 4*time.Second)
			defer cancel()
			outcome = enqueue(ctx, jobs, publisher, value, allowed[value.VideoID])
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		json.NewEncoder(w).Encode(enqueueAck{value.JobID, outcome})
	})
	return &http.Server{
		Handler: handler, ReadHeaderTimeout: time.Second, ReadTimeout: time.Second,
		WriteTimeout: 5 * time.Second, IdleTimeout: time.Second, MaxHeaderBytes: 1024,
		ErrorLog: log.New(io.Discard, "", 0),
	}
}

func enqueue(ctx context.Context, jobs *JobClient, publisher *Publisher, value Payload, allowed bool) string {
	if !allowed {
		return "NOT_ENQUEUED"
	}
	job, err := jobs.Get(ctx, value.JobID)
	if err != nil {
		return "UNCONFIRMED"
	}
	if job.SongID != value.SongID || job.VideoID != value.VideoID {
		return "NOT_ENQUEUED"
	}
	if job.EnqueuedAt != nil {
		return "ENQUEUED"
	}
	if job.Status != "QUEUED" || job.AttemptID != nil {
		return "UNCONFIRMED"
	}
	if publisher.Publish(ctx, value) != nil {
		return "UNCONFIRMED"
	}
	if _, err := jobs.RecordEnqueued(ctx, value, time.Now()); err != nil {
		return "UNCONFIRMED"
	}
	return "ENQUEUED"
}
