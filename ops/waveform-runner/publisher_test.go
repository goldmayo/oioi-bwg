package runner

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/oracle/oci-go-sdk/v65/common"
)

const fixtureQueue = "ocid1.queue.oc1.ap-osaka-1.fixture"
const fixtureEndpoint = "https://cell-1.queue.messaging.ap-osaka-1.oci.oraclecloud.com"

var payload = Payload{"019a0170-0000-7000-8000-000000000001", "019a0170-0000-7000-8000-000000000002", "abcdefghijk"}

// 실제 SDK와 HTTP transport를 사용한다. 서명 키는 검사 중 생성하고 저장하지 않는다.
func fixture(t *testing.T, handler http.HandlerFunc) (*Publisher, *atomic.Int32) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	encoded := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
	provider := common.NewRawConfigurationProvider("fixture", "fixture", "ap-osaka-1", "fixture", string(encoded), nil)
	p, err := newPublisher(fixtureQueue, fixtureEndpoint, provider)
	if err != nil {
		t.Fatal(err)
	}
	count := &atomic.Int32{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count.Add(1)
		w.Header().Set("Content-Type", "application/json")
		handler(w, r)
	}))
	t.Cleanup(server.Close)
	p.client.Host = server.URL
	// SDK client의 재시도 기본값이 바뀌어도 요청별 NoRetry가 우선해야 한다.
	policy := common.DefaultRetryPolicy()
	p.client.Configuration.RetryPolicy = &policy
	return p, count
}

func TestPublishExactPayload(t *testing.T) {
	p, count := fixture(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" || r.URL.Path != "/20210201/queues/"+fixtureQueue+"/messages" || r.URL.RawQuery != "" {
			t.Error("unexpected destination")
		}
		if r.Header.Get("Authorization") == "" || r.Header.Get("opc-retry-token") != "" || r.Header.Get("Idempotency-Key") != "" {
			t.Error("unexpected signing/retry headers")
		}
		body, _ := io.ReadAll(r.Body)
		expected := `{"messages":[{"content":"{\"jobId\":\"019a0170-0000-7000-8000-000000000001\",\"songId\":\"019a0170-0000-7000-8000-000000000002\",\"videoId\":\"abcdefghijk\"}"}]}`
		if strings.TrimSpace(string(body)) != expected {
			t.Errorf("unexpected message shape: %s", body)
		}
		io.WriteString(w, `{"messages":[{"id":123}]}`)
	})
	if err := p.Publish(context.Background(), payload); err != nil {
		t.Fatal(err)
	}
	if count.Load() != 1 {
		t.Fatal("publish count")
	}
}

func TestPublishFailureNeverRetries(t *testing.T) {
	for _, c := range []struct {
		name   string
		status int
		body   string
	}{
		{"server", 500, `{"code":"InternalServerError","message":"PRIVATE_ERROR_MARKER"}`},
		{"throttle", 429, `{"code":"TooManyRequests","message":"PRIVATE_ERROR_MARKER"}`},
		{"redirect", 307, `{}`},
		{"malformed", 200, `{`},
		{"empty", 200, `{"messages":[]}`},
		{"missing-id", 200, `{"messages":[{}]}`},
		{"extra-result", 200, `{"messages":[{"id":1},{"id":2}]}`},
		{"oversize", 200, strings.Repeat(" ", maxPublishResponse+1)},
	} {
		t.Run(c.name, func(t *testing.T) {
			p, count := fixture(t, func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Location", "http://127.0.0.1:1/forbidden")
				w.WriteHeader(c.status)
				io.WriteString(w, c.body)
			})
			if err := p.Publish(context.Background(), payload); err != ErrUnconfirmed {
				t.Fatalf("unsafe error: %v", err)
			}
			if count.Load() != 1 {
				t.Fatal("publish retried")
			}
		})
	}
}

func TestPublishLostResponse(t *testing.T) {
	p, count := fixture(t, func(w http.ResponseWriter, r *http.Request) {
		io.Copy(io.Discard, r.Body)
		connection, _, err := w.(http.Hijacker).Hijack()
		if err != nil {
			t.Error(err)
			return
		}
		connection.Close()
	})
	if err := p.Publish(context.Background(), payload); err != ErrUnconfirmed {
		t.Fatal(err)
	}
	if count.Load() != 1 {
		t.Fatal("response loss retried")
	}
}

func TestPublishResponseLimits(t *testing.T) {
	for _, header := range []string{"Content-Type", "Content-Encoding", "X-Large"} {
		t.Run(header, func(t *testing.T) {
			p, count := fixture(t, func(w http.ResponseWriter, r *http.Request) {
				value := map[string]string{"Content-Type": "text/plain", "Content-Encoding": "gzip", "X-Large": strings.Repeat("x", maxPublishResponse*2)}[header]
				w.Header().Set(header, value)
				io.WriteString(w, `{"messages":[{"id":123}]}`)
			})
			if err := p.Publish(context.Background(), payload); err != ErrUnconfirmed {
				t.Fatal(err)
			}
			if count.Load() != 1 {
				t.Fatal("limit retried")
			}
		})
	}
}

func TestPublishSlowBodyDeadline(t *testing.T) {
	p, count := fixture(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
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
	if err := p.Publish(context.Background(), payload); err != ErrUnconfirmed {
		t.Fatal(err)
	}
	if time.Since(started) > 5*time.Second || count.Load() != 1 {
		t.Fatal("deadline/retry violated")
	}
}

func TestInvalidPayloadAndConfiguration(t *testing.T) {
	p, count := fixture(t, func(http.ResponseWriter, *http.Request) { t.Error("invalid payload sent") })
	for _, value := range []Payload{{"bad", payload.SongID, payload.VideoID}, {payload.JobID, "bad", payload.VideoID}, {payload.JobID, payload.SongID, "bad"}} {
		if err := p.Publish(context.Background(), value); err != ErrPayload {
			t.Fatal(err)
		}
	}
	if count.Load() != 0 {
		t.Fatal("invalid payload sent")
	}
	for _, host := range []string{"http://127.0.0.1", fixtureEndpoint + "/", fixtureEndpoint + "?x=1", "https://other.test"} {
		if _, err := NewPublisher(fixtureQueue, host); err != ErrConfiguration {
			t.Fatal("invalid config accepted")
		}
	}
	if _, err := NewPublisher("bad", fixtureEndpoint); err != ErrConfiguration {
		t.Fatal("invalid queue accepted")
	}
}

func TestPublishCallerCancellation(t *testing.T) {
	started := make(chan struct{})
	p, count := fixture(t, func(w http.ResponseWriter, r *http.Request) {
		io.Copy(io.Discard, r.Body)
		close(started)
		<-r.Context().Done()
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	result := make(chan error, 1)
	go func() { result <- p.Publish(ctx, payload) }()
	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("request did not start")
	}
	cancel()
	select {
	case err := <-result:
		if err != ErrUnconfirmed || count.Load() != 1 {
			t.Fatal("cancellation/retry violated")
		}
	case <-time.After(time.Second):
		t.Fatal("HTTP cancellation ignored")
	}
}

func TestPublishConcurrent(t *testing.T) {
	p, count := fixture(t, func(w http.ResponseWriter, r *http.Request) {
		io.Copy(io.Discard, r.Body)
		io.WriteString(w, `{"messages":[{"id":123}]}`)
	})
	results := make(chan error, 8)
	for range 8 {
		go func() { results <- p.Publish(context.Background(), payload) }()
	}
	for range 8 {
		if err := <-results; err != nil {
			t.Fatal(err)
		}
	}
	if count.Load() != 8 {
		t.Fatal("unexpected request count")
	}
}
