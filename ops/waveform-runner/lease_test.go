package runner

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"
)

func TestLeaseSDKHeartbeat(t *testing.T) {
	c, _ := consumerFixture(t, func(http.ResponseWriter, *http.Request) { t.Error("unexpected real network") })
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		transport := c.client.HTTPClient.(*http.Client).Transport.(boundedTransport)
		transport.base.DialContext = func(context.Context, string, string) (net.Conn, error) {
			server, client := net.Pipe()
			go func() {
				defer server.Close()
				r, err := http.ReadRequest(bufio.NewReader(server))
				if err != nil {
					t.Error(err)
					return
				}
				io.Copy(io.Discard, r.Body)
				r.Body.Close()
				body := batch(message())
				if r.Method == "PUT" {
					body = fmt.Sprintf(`{"id":123,"visibleAfter":%q}`, time.Now().Add(180*time.Second).Format(time.RFC3339Nano))
				} else if r.Method != "GET" {
					t.Error("unexpected SDK operation")
				}
				calls.Add(1)
				fmt.Fprintf(server, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: %d\r\nConnection: close\r\n\r\n%s", len(body), body)
			}()
			return client, nil
		}
		d := receive(t, c)
		err := c.RunWithLease(context.Background(), d, func(ctx context.Context) error {
			time.Sleep(31 * time.Second)
			if ctx.Err() != nil {
				t.Error("SDK heartbeat cancelled valid work")
			}
			return nil
		})
		synctest.Wait()
		if err != nil || calls.Load() != 2 {
			t.Fatal("SDK receive/renewal not connected")
		}
		time.Sleep(time.Hour)
		if calls.Load() != 2 {
			t.Fatal("SDK heartbeat survived work")
		}
	})
}

func leaseDelivery(c *Consumer) *Delivery {
	now := time.Now()
	return &Delivery{Payload: payload, owner: c, receipt: testReceipt, readStarted: now,
		visibleAfter: now.Add(180 * time.Second), expireAfter: now.Add(time.Hour)}
}

func TestLeaseRenewsAndStops(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		c := &Consumer{}
		d := leaseDelivery(c)
		calls := 0
		failure := errors.New("worker failure")
		var child context.Context
		renew := func(ctx context.Context, got *Delivery) (time.Time, error) {
			if got != d || ctx.Err() != nil {
				t.Error("wrong receipt/context")
			}
			calls++
			return time.Now().Add(180 * time.Second), nil
		}
		err := c.withLease(context.Background(), d, func(ctx context.Context) error {
			child = ctx
			time.Sleep(151 * time.Second)
			if ctx.Err() != nil {
				t.Error("confirmed renewals did not extend lease")
			}
			return failure
		}, renew)
		if err != failure || calls != 5 || context.Cause(child) != errLeaseFinished || c.activity.Load() != consumerIdle {
			t.Fatal("normal completion/worker error changed")
		}
		time.Sleep(time.Hour)
		if calls != 5 {
			t.Fatal("heartbeat survived completion")
		}
	})
}

func TestLeaseRejectsInvalidStart(t *testing.T) {
	for _, name := range []string{"owner", "receipt", "expired", "old-read", "future-read", "zero-read", "cancelled", "nil-work"} {
		t.Run(name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				c := &Consumer{}
				d := leaseDelivery(c)
				ctx, cancel := context.WithCancel(context.Background())
				defer cancel()
				want := ErrLeaseLost
				work := func(context.Context) error { t.Error("invalid lease executed"); return nil }
				switch name {
				case "owner":
					d.owner = &Consumer{}
					want = ErrConsume
				case "receipt":
					d.receipt = "../private"
					want = ErrConsume
				case "expired":
					d.expireAfter = time.Now().Add(30 * time.Second)
				case "old-read":
					d.readStarted = time.Now().Add(-151 * time.Second)
				case "future-read":
					d.readStarted = time.Now().Add(time.Second)
				case "zero-read":
					d.readStarted = time.Time{}
				case "cancelled":
					cancel()
					want = context.Canceled
				case "nil-work":
					work = nil
					want = ErrConsume
				}
				err := c.withLease(ctx, d, work, func(context.Context, *Delivery) (time.Time, error) {
					t.Error("invalid lease renewed")
					return time.Time{}, nil
				})
				if err != want || c.activity.Load() != consumerIdle {
					t.Fatal("invalid start accepted/slot leaked")
				}
			})
		})
	}
}

func TestLeaseVisibilityAndRetention(t *testing.T) {
	for _, name := range []string{"short-visibility", "retention", "future-server-time", "late-renewal"} {
		t.Run(name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				c := &Consumer{}
				d := leaseDelivery(c)
				started := time.Now()
				want, wantCalls := 20*time.Second, 0
				switch name {
				case "short-visibility":
					d.visibleAfter = started.Add(50 * time.Second)
				case "retention":
					d.expireAfter = started.Add(100 * time.Second)
					want, wantCalls = 70*time.Second, 2
				case "future-server-time":
					d.visibleAfter, d.expireAfter = started.Add(100*time.Hour), started.Add(200*time.Hour)
					d.readStarted = started.Add(-140 * time.Second)
					want = 10 * time.Second
				case "late-renewal":
					d.visibleAfter = started.Add(61 * time.Second)
					want, wantCalls = 31*time.Second, 1
				}
				calls := 0
				err := c.withLease(context.Background(), d, func(ctx context.Context) error {
					<-ctx.Done()
					if context.Cause(ctx) != ErrLeaseLost {
						t.Error("wrong cancellation cause")
					}
					return nil
				}, func(context.Context, *Delivery) (time.Time, error) {
					calls++
					if name == "late-renewal" {
						time.Sleep(time.Second)
					}
					return time.Now().Add(180 * time.Second), nil
				})
				if err != ErrLeaseLost || time.Since(started) != want || calls != wantCalls {
					t.Fatal("unsafe visibility/retention deadline")
				}
			})
		})
	}
}

func TestLeaseRenewalFailureAndLateResponse(t *testing.T) {
	for _, delay := range []time.Duration{0, 2100 * time.Millisecond} {
		synctest.Test(t, func(t *testing.T) {
			c := &Consumer{}
			d := leaseDelivery(c)
			started := time.Now()
			var stopped time.Duration
			calls := 0
			err := c.withLease(context.Background(), d, func(ctx context.Context) error {
				<-ctx.Done()
				stopped = time.Since(started)
				return nil
			}, func(context.Context, *Delivery) (time.Time, error) {
				calls++
				if delay == 0 {
					return time.Time{}, ErrConsume
				}
				time.Sleep(delay)
				return time.Now().Add(180 * time.Second), nil
			})
			wantStop := 30 * time.Second
			if delay != 0 {
				wantStop += 2 * time.Second
			}
			if err != ErrLeaseLost || calls != 1 || stopped != wantStop || c.activity.Load() != consumerIdle {
				t.Fatal("late/error renewal kept work alive")
			}
			if err := c.withLease(context.Background(), d, func(context.Context) error { t.Error("old delivery restarted"); return nil }, nil); err != ErrLeaseLost {
				t.Fatal("lost receipt reused")
			}
			fresh := leaseDelivery(c)
			if err := c.withLease(context.Background(), fresh, func(context.Context) error { return nil }, nil); err != nil {
				t.Fatal("redelivery could not acquire released slot")
			}
		})
	}
}

func TestLeaseShutdownWaitsForCleanup(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		c := &Consumer{}
		ctx, cancel := context.WithCancel(context.Background())
		clean := make(chan struct{})
		done := make(chan error, 1)
		go func() {
			done <- c.withLease(ctx, leaseDelivery(c), func(child context.Context) error { <-child.Done(); <-clean; return nil }, nil)
		}()
		synctest.Wait()
		cancel()
		synctest.Wait()
		if _, err := c.Poll(context.Background()); err != ErrConsume {
			t.Fatal("poll before cleanup")
		}
		if err := c.withLease(context.Background(), leaseDelivery(c), func(context.Context) error { t.Error("second worker started"); return nil }, nil); err != ErrConsume {
			t.Fatal("parallel execution admitted")
		}
		select {
		case <-done:
			t.Fatal("returned before cleanup")
		default:
		}
		close(clean)
		if err := <-done; err != context.Canceled || c.activity.Load() != consumerIdle {
			t.Fatal("shutdown/cleanup lost")
		}
	})
}

func TestLeaseStalledSDKQuarantinesConsumer(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		c := &Consumer{}
		blocked := make(chan struct{})
		var calls atomic.Int32
		started := time.Now()
		err := c.withLease(context.Background(), leaseDelivery(c), func(ctx context.Context) error {
			<-ctx.Done()
			if context.Cause(ctx) != ErrLeaseLost || time.Since(started) != 32*time.Second {
				t.Error("watchdog waited on stuck SDK")
			}
			return nil
		}, func(context.Context, *Delivery) (time.Time, error) {
			calls.Add(1)
			<-blocked
			return time.Now().Add(180 * time.Second), nil
		})
		if err != ErrRunnerStalled || time.Since(started) != 35*time.Second {
			t.Fatal("stuck SDK was not quarantined")
		}
		if _, err := c.Poll(context.Background()); err != ErrRunnerStalled {
			t.Fatal("quarantine allowed polling")
		}
		if err := c.withLease(context.Background(), leaseDelivery(c), func(context.Context) error { t.Error("quarantine ran work"); return nil }, nil); err != ErrRunnerStalled {
			t.Fatal("quarantine allowed execution")
		}
		close(blocked)
		synctest.Wait()
		time.Sleep(time.Hour)
		if calls.Load() != 1 {
			t.Fatal("SDK goroutines accumulated")
		}
		if _, err := c.Poll(context.Background()); err != ErrRunnerStalled {
			t.Fatal("late SDK response reopened consumer")
		}
	})
}

func TestLeaseCompletionDrainsRenewal(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		c := &Consumer{}
		ended := false
		err := c.withLease(context.Background(), leaseDelivery(c), func(context.Context) error {
			time.Sleep(30100 * time.Millisecond)
			return nil
		}, func(ctx context.Context, _ *Delivery) (time.Time, error) {
			<-ctx.Done()
			time.Sleep(500 * time.Millisecond)
			ended = true
			return time.Time{}, ctx.Err()
		})
		if err != nil || !ended || c.activity.Load() != consumerIdle {
			t.Fatal("slot released before renewal stopped")
		}
	})
}

func TestLeaseCompletionAtRenewalDeadline(t *testing.T) {
	for _, offset := range []time.Duration{-time.Nanosecond, 0, time.Nanosecond} {
		t.Run(offset.String(), func(t *testing.T) {
			unexpected := 0
			for range 200 {
				synctest.Test(t, func(t *testing.T) {
					c := &Consumer{}
					calls := 0
					var child context.Context
					err := c.withLease(context.Background(), leaseDelivery(c), func(ctx context.Context) error {
						child = ctx
						time.Sleep(32*time.Second + offset)
						return nil
					}, func(ctx context.Context, _ *Delivery) (time.Time, error) {
						calls++
						<-ctx.Done()
						return time.Time{}, ctx.Err()
					})
					want, cause := ErrLeaseLost, ErrLeaseLost
					if offset < 0 {
						want, cause = nil, errLeaseFinished
					}
					if err != want || context.Cause(child) != cause {
						unexpected++
					}
					if calls != 1 || c.activity.Load() != consumerIdle {
						t.Fatal("renewal/slot cleanup changed at completion boundary")
					}
				})
			}
			if unexpected != 0 {
				t.Fatalf("wrong lease result at completion/renewal boundary: %d/200", unexpected)
			}
		})
	}
}
