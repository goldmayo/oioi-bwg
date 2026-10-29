package runner

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"
)

func TestServiceLifetime(t *testing.T) {
	for _, scenario := range []string{"cancel", "startup cleanup", "final cleanup", "fatal consume", "listener failure", "transient"} {
		t.Run(scenario, func(t *testing.T) {
			listener, err := net.Listen("unix", filepath.Join(t.TempDir(), "runner.sock"))
			if err != nil {
				t.Fatal(err)
			}
			root, cancel := context.WithCancel(context.Background())
			defer cancel()
			var cleanups, calls atomic.Int32
			entered := make(chan struct{}, 2)
			worker := processWorker{cleanup: func(context.Context) error {
				n := cleanups.Add(1)
				if scenario == "startup cleanup" || (scenario == "final cleanup" && n == 2) {
					return ErrRunnerStalled
				}
				return nil
			}}
			server := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) })}
			consume := func(ctx context.Context) error {
				n := calls.Add(1)
				if cleanups.Load() != 1 {
					t.Error("consume before boot cleanup")
				}
				entered <- struct{}{}
				if scenario == "fatal consume" {
					return ErrRunnerStalled
				}
				if scenario == "transient" && n == 1 {
					return ErrConsume
				}
				<-ctx.Done()
				return context.Cause(ctx)
			}
			done := make(chan error, 1)
			go func() { done <- serve(root, cancel, listener, server, worker, consume) }()
			if scenario != "startup cleanup" {
				select {
				case <-entered:
				case <-time.After(5 * time.Second):
					t.Fatal("consumer not started")
				}
				if scenario == "transient" {
					select {
					case <-entered:
					case <-time.After(4 * time.Second):
						t.Fatal("retry not bounded")
					}
				}
				if scenario == "listener failure" {
					listener.Close()
				} else {
					cancel()
				}
			}
			var result error
			select {
			case result = <-done:
			case <-time.After(5 * time.Second):
				t.Fatal("service did not stop")
			}
			expected := error(nil)
			switch scenario {
			case "startup cleanup", "final cleanup", "fatal consume":
				expected = ErrRunnerStalled
			case "listener failure":
				expected = ErrService
			}
			if !errors.Is(result, expected) {
				t.Fatalf("got %v want %v", result, expected)
			}
			if scenario == "startup cleanup" {
				if calls.Load() != 0 || cleanups.Load() != 1 {
					t.Fatal("startup failure continued")
				}
			} else if cleanups.Load() != 2 {
				t.Fatal("missing final cleanup")
			}
			if connection, e := net.DialTimeout("unix", listener.Addr().String(), time.Second); e == nil {
				connection.Close()
				t.Fatal("listener survived shutdown")
			}
		})
	}
}

func TestServiceAlternatesDeadLetterAndNormalQueue(t *testing.T) {
	root, cancel := context.WithCancel(context.Background())
	defer cancel()
	var polls, cleanups atomic.Int32
	publisher, _ := fixture(t, func(w http.ResponseWriter, r *http.Request) {
		n := polls.Add(1)
		want := "/20210201/queues/" + fixtureQueue
		wait := "30"
		if n%2 == 1 {
			want += "-dlq"
			wait = "0"
		}
		if r.URL.Path != want+"/messages" || r.URL.Query().Get("timeoutInSeconds") != wait {
			t.Error("scheduler destination/options")
		}
		if n == 1 {
			w.WriteHeader(500)
			io.WriteString(w, `{}`)
			return
		}
		if n >= 3 {
			cancel()
		}
		io.WriteString(w, `{"messages":[]}`)
	})
	consumer, err := NewConsumer(publisher)
	if err != nil {
		t.Fatal(err)
	}
	jobs, _ := jobFixture(t, func(http.ResponseWriter, *http.Request) { t.Error("empty poll accessed Job") })
	listener, err := net.Listen("unix", filepath.Join(t.TempDir(), "runner.sock"))
	if err != nil {
		t.Fatal(err)
	}
	worker := processWorker{cleanup: func(context.Context) error { cleanups.Add(1); return nil }}
	done := make(chan error, 1)
	go func() { done <- Serve(root, listener, jobs, publisher, consumer, worker, nil) }()
	select {
	case err = <-done:
	case <-time.After(6 * time.Second):
		t.Fatal("DLQ failure starved normal queue")
	}
	if err != nil || polls.Load() != 3 || cleanups.Load() != 2 {
		t.Fatalf("service outcome: %v polls=%d cleanup=%d", err, polls.Load(), cleanups.Load())
	}
}

func TestServiceDrainsHTTPBeforeFinalCleanup(t *testing.T) {
	listener, err := net.Listen("unix", filepath.Join(t.TempDir(), "runner.sock"))
	if err != nil {
		t.Fatal(err)
	}
	root, cancel := context.WithCancel(context.Background())
	defer cancel()
	entered, release, draining := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var cleanups atomic.Int32
	worker := processWorker{cleanup: func(context.Context) error { cleanups.Add(1); return nil }}
	server := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { close(entered); <-release; w.WriteHeader(204) })}
	server.RegisterOnShutdown(func() { close(draining) })
	done := make(chan error, 1)
	go func() {
		done <- serve(root, cancel, listener, server, worker, func(ctx context.Context) error { <-ctx.Done(); return ctx.Err() })
	}()
	transport := &http.Transport{DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", listener.Addr().String())
	}}
	defer transport.CloseIdleConnections()
	response := make(chan error, 1)
	go func() {
		r, e := (&http.Client{Transport: transport, Timeout: 3 * time.Second}).Get("http://unix/")
		if e == nil {
			r.Body.Close()
		}
		response <- e
	}()
	select {
	case <-entered:
	case <-time.After(time.Second):
		close(release)
		t.Fatal("request did not start")
	}
	cancel()
	select {
	case <-draining:
	case <-time.After(time.Second):
		close(release)
		t.Fatal("shutdown did not start")
	}
	if cleanups.Load() != 1 {
		close(release)
		t.Fatal("cleanup before request drain")
	}
	close(release)
	select {
	case err = <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("shutdown stuck")
	}
	if err != nil || cleanups.Load() != 2 {
		t.Fatalf("cleanup outcome %v", err)
	}
	if err = <-response; err != nil {
		t.Fatal(err)
	}
}
