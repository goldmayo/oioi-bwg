package runner

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

const testReceipt = "c291cmNlX3JlY2VpcHQ"

func message() map[string]any {
	body, _ := json.Marshal(payload)
	now := time.Now().UTC()
	return map[string]any{"id": 123, "content": string(body), "receipt": testReceipt, "deliveryCount": 2,
		"visibleAfter": now.Add(180 * time.Second), "expireAfter": now.Add(24 * time.Hour), "createdAt": now}
}
func batch(messages ...map[string]any) string {
	body, _ := json.Marshal(map[string]any{"messages": messages})
	return string(body)
}
func consumerFixture(t *testing.T, handler http.HandlerFunc) (*Consumer, *atomic.Int32) {
	t.Helper()
	p, count := fixture(t, handler)
	c, err := NewConsumer(p)
	if err != nil {
		t.Fatal(err)
	}
	if p.client.HTTPClient.(*http.Client).Timeout != publishDeadline || c.client.HTTPClient.(*http.Client).Timeout != pollDeadline {
		t.Fatal("poll changed publisher deadline")
	}
	return c, count
}
func receive(t *testing.T, c *Consumer) *Delivery {
	t.Helper()
	d, err := c.Poll(context.Background())
	if err != nil || d == nil {
		t.Fatalf("receive failed: %v", err)
	}
	return d
}

func TestConsumerExactRequests(t *testing.T) {
	c, count := consumerFixture(t, func(w http.ResponseWriter, r *http.Request) {
		path := "/20210201/queues/" + fixtureQueue + "/messages"
		if r.Header.Get("Authorization") == "" || r.Header.Get("opc-retry-token") != "" {
			t.Error("signing/retry contract")
		}
		switch r.Method {
		case "GET":
			if r.URL.Path != path || r.URL.Query().Encode() != "limit=1&timeoutInSeconds=30&visibilityInSeconds=180" {
				t.Error("unexpected poll destination/options")
			}
			io.WriteString(w, batch(message()))
		case "PUT":
			body, _ := io.ReadAll(r.Body)
			if r.URL.Path != path+"/"+testReceipt || r.URL.RawQuery != "" || strings.TrimSpace(string(body)) != `{"visibilityInSeconds":180}` {
				t.Error("unexpected renewal")
			}
			io.WriteString(w, `{"id":123,"visibleAfter":"2099-01-01T00:00:00Z"}`)
		case "DELETE":
			if r.URL.Path != path+"/"+testReceipt || r.URL.RawQuery != "" {
				t.Error("unexpected deletion")
			}
			w.Header().Del("Content-Type")
			w.WriteHeader(204)
		default:
			t.Error("unexpected method")
		}
	})
	d := receive(t, c)
	if d.Payload != payload || d.deliveryCount != 2 || d.receipt != testReceipt || d.readStarted.IsZero() {
		t.Fatal("delivery projection")
	}
	if at, err := c.Renew(context.Background(), d); err != nil || at.Year() != 2099 {
		t.Fatal("renewal rejected")
	}
	if err := c.Delete(context.Background(), d); err != nil || count.Load() != 3 {
		t.Fatal("204 without JSON content type rejected")
	}
}

func TestPollEmptyAndMalformed(t *testing.T) {
	for _, name := range []string{"empty", "missing", "null", "multiple", "receipt", "count", "time", "id"} {
		t.Run(name, func(t *testing.T) {
			m := message()
			body := batch(m)
			switch name {
			case "empty":
				body = `{"messages":[]}`
			case "missing":
				body = `{}`
			case "null":
				body = `{"messages":null}`
			case "multiple":
				body = batch(m, m)
			case "receipt":
				m["receipt"] = "../private"
			case "count":
				m["deliveryCount"] = 0
			case "time":
				m["visibleAfter"] = "bad"
			case "id":
				m["id"] = nil
			}
			if name == "receipt" || name == "count" || name == "time" || name == "id" {
				body = batch(m)
			}
			c, count := consumerFixture(t, func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, body) })
			d, err := c.Poll(context.Background())
			if d != nil || (name == "empty" && err != nil) || (name != "empty" && err != ErrConsume) || count.Load() != 1 {
				t.Fatal("empty/malformed distinction violated")
			}
		})
	}
}

func TestPollRejectsPayload(t *testing.T) {
	valid := message()["content"].(string)
	for _, content := range []string{`null`, `{}`, valid + `{}`, strings.Replace(valid, `"jobId"`, `"JOBID"`, 1), strings.Replace(valid, payload.SongID, "bad", 1), strings.Replace(valid, `"videoId":`, `"command":"bad","videoId":`, 1), strings.Repeat(" ", 1025-len(valid)) + valid} {
		m := message()
		m["content"] = content
		c, count := consumerFixture(t, func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, batch(m)) })
		if d, err := c.Poll(context.Background()); d != nil || err != ErrPayload || count.Load() != 1 {
			t.Fatal("invalid payload reached delivery")
		}
	}
}

func TestConsumerFailuresNeverRetry(t *testing.T) {
	for _, operation := range []string{"poll", "renew", "delete"} {
		for _, fault := range []string{"server", "throttle", "redirect", "lost", "json", "oversize", "type", "encoding", "header"} {
			t.Run(operation+"/"+fault, func(t *testing.T) {
				c, count := consumerFixture(t, func(w http.ResponseWriter, r *http.Request) {
					if operation != "poll" && r.Method == "GET" {
						io.WriteString(w, batch(message()))
						return
					}
					io.Copy(io.Discard, r.Body)
					switch fault {
					case "server":
						w.WriteHeader(500)
					case "throttle":
						w.WriteHeader(429)
					case "redirect":
						w.Header().Set("Location", "http://127.0.0.1:1/private")
						w.WriteHeader(307)
					case "lost":
						connection, _, _ := w.(http.Hijacker).Hijack()
						connection.Close()
						return
					case "type":
						w.Header().Set("Content-Type", "text/plain")
					case "encoding":
						w.Header().Set("Content-Encoding", "gzip")
					case "header":
						w.Header().Set("X-Large", strings.Repeat("x", 16384))
					}
					body := batch(message())
					if operation != "poll" {
						body = `{"id":123,"visibleAfter":"2099-01-01T00:00:00Z"}`
					}
					if fault == "json" {
						body = `{`
					}
					if fault == "oversize" {
						body = strings.Repeat(" ", 4097)
					}
					io.WriteString(w, body)
				})
				var err error
				want := int32(1)
				if operation == "poll" {
					_, err = c.Poll(context.Background())
				} else {
					d := receive(t, c)
					want++
					if operation == "renew" {
						_, err = c.Renew(context.Background(), d)
					} else {
						err = c.Delete(context.Background(), d)
					}
				}
				if err != ErrConsume || count.Load() != want {
					t.Fatal("unsafe error/retry")
				}
			})
		}
	}
}

func TestPollLongWaitAndSingleReader(t *testing.T) {
	started := make(chan struct{})
	c, count := consumerFixture(t, func(w http.ResponseWriter, r *http.Request) {
		close(started)
		timer := time.NewTimer(2200 * time.Millisecond)
		defer timer.Stop()
		select {
		case <-timer.C:
		case <-r.Context().Done():
			return
		}
		io.WriteString(w, `{"messages":[]}`)
	})
	done := make(chan error, 1)
	go func() { _, err := c.Poll(context.Background()); done <- err }()
	<-started
	if _, err := c.Poll(context.Background()); err != ErrConsume || count.Load() != 1 {
		t.Fatal("parallel poll admitted")
	}
	// publisher의 2초 HTTP 기한과 분리됐는지 실제 지연으로 확인한다.
	if err := <-done; err != nil {
		t.Fatal("long poll used publish deadline")
	}
}

func TestConsumerCancellation(t *testing.T) {
	for _, operation := range []string{"poll", "renew", "delete"} {
		t.Run(operation, func(t *testing.T) {
			started := make(chan struct{})
			c, count := consumerFixture(t, func(w http.ResponseWriter, r *http.Request) {
				if operation != "poll" && r.Method == "GET" {
					io.WriteString(w, batch(message()))
					return
				}
				io.Copy(io.Discard, r.Body)
				close(started)
				<-r.Context().Done()
			})
			var d *Delivery
			if operation != "poll" {
				d = receive(t, c)
			}
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			done := make(chan error, 1)
			go func() {
				var err error
				switch operation {
				case "poll":
					_, err = c.Poll(ctx)
				case "renew":
					_, err = c.Renew(ctx, d)
				case "delete":
					err = c.Delete(ctx, d)
				}
				done <- err
			}()
			<-started
			cancel()
			select {
			case err := <-done:
				if err != ErrConsume {
					t.Fatal("unsafe cancellation error")
				}
			case <-time.After(time.Second):
				t.Fatal("HTTP cancellation ignored")
			}
			want := int32(1)
			if operation != "poll" {
				want++
			}
			if count.Load() != want {
				t.Fatal("cancel retried")
			}
		})
	}
}

func TestConsumerRejectsForeignReceiptAndRenewal(t *testing.T) {
	c, count := consumerFixture(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" {
			io.WriteString(w, batch(message()))
		} else {
			io.WriteString(w, `{"id":124,"visibleAfter":"2099-01-01T00:00:00Z"}`)
		}
	})
	for _, d := range []*Delivery{nil, {owner: &Consumer{}, receipt: testReceipt}, {owner: c, receipt: "../private"}, {owner: c, receipt: strings.Repeat("a", 2049)}} {
		if _, err := c.Renew(context.Background(), d); err != ErrConsume {
			t.Fatal("foreign receipt renewed")
		}
		if err := c.Delete(context.Background(), d); err != ErrConsume {
			t.Fatal("foreign receipt deleted")
		}
	}
	if count.Load() != 0 {
		t.Fatal("invalid receipt sent")
	}
	d := receive(t, c)
	if _, err := c.Renew(context.Background(), d); err != ErrConsume || count.Load() != 2 {
		t.Fatal("different message accepted")
	}
	if _, err := NewConsumer(nil); err != ErrConfiguration {
		t.Fatal("invalid publisher accepted")
	}
}

func TestConsumerMaintenanceDeadline(t *testing.T) {
	for _, operation := range []string{"renew", "delete"} {
		t.Run(operation, func(t *testing.T) {
			c, count := consumerFixture(t, func(w http.ResponseWriter, r *http.Request) {
				if r.Method == "GET" {
					io.WriteString(w, batch(message()))
					return
				}
				io.Copy(io.Discard, r.Body)
				w.WriteHeader(200)
				w.(http.Flusher).Flush()
				<-r.Context().Done()
			})
			d := receive(t, c)
			started := time.Now()
			var err error
			if operation == "renew" {
				_, err = c.Renew(context.Background(), d)
			} else {
				err = c.Delete(context.Background(), d)
			}
			if err != ErrConsume || time.Since(started) > 4*time.Second || count.Load() != 2 {
				t.Fatal("maintenance used long poll deadline/retry")
			}
		})
	}
}
