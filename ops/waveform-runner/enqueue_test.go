package runner

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type enqueueFixture struct {
	client      *http.Client
	path        string
	server      *http.Server
	puts, calls *atomic.Int32
}

func ingress(t *testing.T, job http.HandlerFunc, push http.HandlerFunc, approved []string) enqueueFixture {
	t.Helper()
	jobs, calls := jobFixture(t, job)
	publisher, puts := fixture(t, push)
	root, cancel := context.WithCancel(context.Background())
	server := NewEnqueueServer(root, jobs, publisher, approved)
	path := filepath.Join(t.TempDir(), "runner.sock")
	listener, err := net.Listen("unix", path)
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() { done <- server.Serve(listener) }()
	transport := &http.Transport{DisableKeepAlives: true, DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", path)
	}}
	t.Cleanup(func() { cancel(); server.Close(); <-done; transport.CloseIdleConnections() })
	return enqueueFixture{&http.Client{Transport: transport, Timeout: 6 * time.Second}, path, server, puts, calls}
}
func (f enqueueFixture) post(value string) (int, enqueueAck, error) {
	response, err := f.client.Post("http://localhost/enqueue", "application/json", strings.NewReader(value))
	if err != nil {
		return 0, enqueueAck{}, err
	}
	defer response.Body.Close()
	var ack enqueueAck
	if response.StatusCode == 200 {
		body, readErr := io.ReadAll(response.Body)
		var fields map[string]json.RawMessage
		err = json.Unmarshal(body, &ack)
		if readErr != nil || json.Unmarshal(body, &fields) != nil || len(fields) != 2 || fields["jobId"] == nil || fields["outcome"] == nil {
			err = fmt.Errorf("invalid ACK contract")
		}
	}
	return response.StatusCode, ack, err
}
func input() string                                   { body, _ := json.Marshal(payload); return string(body) }
func accepted(w http.ResponseWriter, r *http.Request) { io.WriteString(w, `{"messages":[{"id":123}]}`) }
func recorded() string {
	return strings.Replace(jobJSON, `"enqueuedAt":null`, `"enqueuedAt":"2026-10-29T00:00:00Z"`, 1)
}
func normalJob(w http.ResponseWriter, r *http.Request) {
	if r.Method == "POST" {
		io.Copy(io.Discard, r.Body)
		io.WriteString(w, recorded())
	} else {
		io.WriteString(w, jobJSON)
	}
}

func TestEnqueueOrderAndAck(t *testing.T) {
	var stage atomic.Int32
	job := func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" {
			if !stage.CompareAndSwap(0, 1) {
				t.Error("lookup order")
			}
		} else if !stage.CompareAndSwap(2, 3) {
			t.Error("record before Put")
		}
		normalJob(w, r)
	}
	f := ingress(t, job, func(w http.ResponseWriter, r *http.Request) {
		if !stage.CompareAndSwap(1, 2) {
			t.Error("Put before lookup")
		}
		accepted(w, r)
	}, []string{payload.VideoID})
	status, ack, err := f.post(input())
	if err != nil || status != 200 || ack != (enqueueAck{payload.JobID, "ENQUEUED"}) || stage.Load() != 3 || f.puts.Load() != 1 {
		t.Fatal("enqueue order/ACK invalid")
	}
}

func TestEnqueueStateAndFailure(t *testing.T) {
	for _, c := range []struct {
		name, job, outcome                       string
		getStatus, putStatus, recordStatus, puts int
		approved                                 bool
	}{
		{"unapproved", jobJSON, "NOT_ENQUEUED", 200, 200, 200, 0, false},
		{"source", strings.Replace(jobJSON, payload.VideoID, "lmnopqrstuv", 1), "NOT_ENQUEUED", 200, 200, 200, 0, true},
		{"confirmed", recorded(), "ENQUEUED", 200, 200, 200, 0, true},
		{"running", strings.Replace(jobJSON, "QUEUED", "RUNNING", 1), "UNCONFIRMED", 200, 200, 200, 0, true},
		{"lookup", "{}", "UNCONFIRMED", 403, 200, 200, 0, true},
		{"put", jobJSON, "UNCONFIRMED", 200, 500, 200, 1, true},
		{"record", jobJSON, "UNCONFIRMED", 200, 200, 500, 1, true},
	} {
		t.Run(c.name, func(t *testing.T) {
			job := func(w http.ResponseWriter, r *http.Request) {
				if r.Method == "GET" {
					w.WriteHeader(c.getStatus)
					io.WriteString(w, c.job)
				} else {
					w.WriteHeader(c.recordStatus)
					io.WriteString(w, recorded())
				}
			}
			push := func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(c.putStatus); accepted(w, r) }
			var approved []string
			if c.approved {
				approved = []string{payload.VideoID}
			}
			f := ingress(t, job, push, approved)
			status, ack, err := f.post(input())
			if err != nil || status != 200 || ack.Outcome != c.outcome || int(f.puts.Load()) != c.puts {
				t.Fatalf("unexpected outcome: %v %v", ack, err)
			}
		})
	}
}

func TestEnqueueRecordResponseLoss(t *testing.T) {
	var saved atomic.Bool
	job := func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" {
			io.Copy(io.Discard, r.Body)
			saved.Store(true)
			connection, _, err := w.(http.Hijacker).Hijack()
			if err != nil {
				t.Error(err)
				return
			}
			connection.Close()
		} else if saved.Load() {
			io.WriteString(w, recorded())
		} else {
			io.WriteString(w, jobJSON)
		}
	}
	f := ingress(t, job, accepted, []string{payload.VideoID})
	_, ack, err := f.post(input())
	if err != nil || ack.Outcome != "UNCONFIRMED" || !saved.Load() {
		t.Fatal("lost confirmation treated as success/failure")
	}
	_, ack, err = f.post(input())
	if err != nil || ack.Outcome != "ENQUEUED" || f.puts.Load() != 1 {
		t.Fatal("confirmed Job republished")
	}
}

func TestEnqueueSurvivesSocketLoss(t *testing.T) {
	put, release, saved := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var once sync.Once
	unblock := func() { once.Do(func() { close(release) }) }
	defer unblock()
	job := func(w http.ResponseWriter, r *http.Request) {
		normalJob(w, r)
		if r.Method == "POST" {
			close(saved)
		}
	}
	f := ingress(t, job, func(w http.ResponseWriter, r *http.Request) { close(put); <-release; accepted(w, r) }, []string{payload.VideoID})
	connection, err := net.Dial("unix", f.path)
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	request, _ := http.NewRequest("POST", "http://localhost/enqueue", strings.NewReader(input()))
	request.Header.Set("Content-Type", "application/json")
	if err := request.Write(connection); err != nil {
		t.Fatal(err)
	}
	select {
	case <-put:
	case <-time.After(time.Second):
		t.Fatal("Put did not start")
	}
	connection.Close()
	unblock()
	select {
	case <-saved:
	case <-time.After(2 * time.Second):
		t.Fatal("socket loss cancelled confirmation")
	}
	if f.puts.Load() != 1 {
		t.Fatal("Put repeated")
	}
}

func TestEnqueueRejectsTCPAndMalformedBody(t *testing.T) {
	f := ingress(t, normalJob, accepted, []string{payload.VideoID})
	tcp := httptest.NewServer(f.server.Handler)
	defer tcp.Close()
	response, err := http.Post(tcp.URL+"/enqueue", "application/json", strings.NewReader(input()))
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 403 {
		t.Fatal("TCP accepted")
	}
	for _, body := range []string{`null`, `{}`, input() + `{}`, strings.Repeat(" ", 1025-len(input())) + input(), strings.Replace(input(), `"jobId"`, `"JOBID"`, 1), strings.Replace(input(), `"songId":`, `"command":"bad","songId":`, 1)} {
		status, _, err := f.post(body)
		if err != nil || status == 200 {
			t.Fatal("malformed body accepted")
		}
	}
	if f.puts.Load() != 0 || f.calls.Load() != 0 {
		t.Fatal("invalid ingress contacted dependencies")
	}
}

func TestEnqueueHeaderAndChunkedLimits(t *testing.T) {
	f := ingress(t, normalJob, accepted, []string{payload.VideoID})
	for _, change := range []func(*http.Request){
		func(r *http.Request) { r.Method = "GET" },
		func(r *http.Request) { r.URL.RawQuery = "x=1" },
		func(r *http.Request) { r.Header.Set("Origin", "") },
		func(r *http.Request) { r.Header.Set("Content-Type", "text/plain") },
		func(r *http.Request) { r.Header.Set("Content-Encoding", "gzip") },
		func(r *http.Request) { r.Header.Set("X-Large", strings.Repeat("x", 16384)) },
	} {
		r, _ := http.NewRequest("POST", "http://localhost/enqueue", strings.NewReader(input()))
		r.Header.Set("Content-Type", "application/json")
		change(r)
		response, err := f.client.Do(r)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		if response.StatusCode == 200 {
			t.Fatal("invalid header/method accepted")
		}
	}
	body := strings.Repeat(" ", 1025-len(input())) + input()
	r, _ := http.NewRequest("POST", "http://localhost/enqueue", strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	r.ContentLength = -1
	r.TransferEncoding = []string{"chunked"}
	response, err := f.client.Do(r)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode == 200 || f.puts.Load() != 0 || f.calls.Load() != 0 {
		t.Fatal("chunked body exceeded limit")
	}
}

func TestEnqueueSlowBody(t *testing.T) {
	f := ingress(t, normalJob, accepted, []string{payload.VideoID})
	connection, err := net.Dial("unix", f.path)
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	connection.SetDeadline(time.Now().Add(3 * time.Second))
	fmt.Fprintf(connection, "POST /enqueue HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: %d\r\n\r\n", len(input()))
	stop, done := make(chan struct{}), make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(50 * time.Millisecond)
		defer ticker.Stop()
		for _, b := range []byte(input()) {
			select {
			case <-stop:
				return
			case <-ticker.C:
				if _, err := connection.Write([]byte{b}); err != nil {
					return
				}
			}
		}
	}()
	started := time.Now()
	response, err := http.ReadResponse(bufio.NewReader(connection), nil)
	close(stop)
	connection.Close()
	<-done
	if response != nil {
		response.Body.Close()
	}
	if err != nil || response.StatusCode == 200 || time.Since(started) > 2*time.Second || f.puts.Load() != 0 || f.calls.Load() != 0 {
		t.Fatal("slow body limit violated")
	}
}

func TestEnqueueAdmissionAndDuplicate(t *testing.T) {
	started, release := make(chan struct{}, 8), make(chan struct{})
	var once sync.Once
	unblock := func() { once.Do(func() { close(release) }) }
	defer unblock()
	job := func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, jobPath), "/enqueued")
		body := jobJSON
		if r.Method == "POST" {
			body = recorded()
		}
		io.WriteString(w, strings.Replace(body, payload.JobID, id, 1))
	}
	f := ingress(t, job, func(w http.ResponseWriter, r *http.Request) { started <- struct{}{}; <-release; accepted(w, r) }, []string{payload.VideoID})
	type result struct {
		status int
		ack    enqueueAck
		err    error
	}
	results := make(chan result, 8)
	send := func(body string) { status, ack, err := f.post(body); results <- result{status, ack, err} }
	go send(input())
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("first publish missing")
	}
	status, ack, err := f.post(input())
	if err != nil || status != 200 || ack.Outcome != "UNCONFIRMED" || f.puts.Load() != 1 {
		t.Fatal("concurrent duplicate published")
	}
	for i := 2; i <= 8; i++ {
		body := strings.Replace(input(), payload.JobID, fmt.Sprintf("019a0170-0000-7000-8000-%012d", i), 1)
		go send(body)
	}
	for range 7 {
		select {
		case <-started:
		case <-time.After(time.Second):
			t.Fatal("slots did not fill")
		}
	}
	status, _, err = f.post(input())
	if err != nil || status != 503 || f.puts.Load() != 8 {
		t.Fatal("admission limit violated")
	}
	unblock()
	for range 8 {
		result := <-results
		if result.err != nil || result.status != 200 || result.ack.Outcome != "ENQUEUED" {
			t.Fatal("admitted request failed")
		}
	}
}
