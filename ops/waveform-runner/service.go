package runner

import (
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"slices"
	"time"
)

const consumerBackoff = 2 * time.Second

// Serve는 host lock을 보유한 호출자가 제공한 Unix listener에서 상주 수명을 실행한다.
// Instance Principal 초기화·설정/권한 검증은 시작 경로가 맡고, 작업마다 client를 만들지 않는다.
func Serve(ctx context.Context, listener net.Listener, jobs *JobClient, publisher *Publisher, consumer *Consumer, worker FixedWorker, approved []string) error {
	if listener == nil || listener.Addr().Network() != "unix" || jobs == nil || publisher == nil || consumer == nil || worker == nil {
		return ErrConfiguration
	}
	for _, id := range approved {
		if !videoID.MatchString(id) {
			return ErrConfiguration
		}
	}
	approved = slices.Clone(approved)
	root, cancel := context.WithCancel(ctx)
	defer cancel()
	server := NewEnqueueServer(root, jobs, publisher, approved)
	deadLetter := false
	return serve(root, cancel, listener, server, worker, func(ctx context.Context) error {
		deadLetter = !deadLetter
		if deadLetter {
			return consumer.ConsumeDeadLetterOne(ctx, jobs, worker)
		}
		return consumer.ConsumeOne(ctx, jobs, worker, approved)
	})
}

func serve(ctx context.Context, cancel context.CancelFunc, listener net.Listener, server *http.Server, worker FixedWorker, consume func(context.Context) error) (err error) {
	defer listener.Close()
	if ctx.Err() != nil {
		return context.Cause(ctx)
	}
	// 재시작에서 첫 poll보다 먼저 전용 컨테이너 부재를 확인한다.
	if worker.Cleanup(ctx) != nil {
		return ErrRunnerStalled
	}
	served := make(chan error, 1)
	go func() {
		serveErr := server.Serve(listener)
		served <- serveErr
		cancel()
	}()
	defer func() {
		cancel()
		shutdown, stop := context.WithTimeout(context.Background(), 10*time.Second)
		defer stop()
		shutdownErr := server.Shutdown(shutdown)
		if shutdownErr != nil {
			server.Close()
		}
		serveErr := <-served
		// worker 자체의 제한된 cleanup을 끝내고 나서 host lock을 해제한다.
		if worker.Cleanup(context.Background()) != nil {
			err = ErrRunnerStalled
			return
		}
		if shutdownErr != nil || !errors.Is(serveErr, http.ErrServerClosed) {
			err = ErrService
		}
	}()
	reported := false
	for ctx.Err() == nil {
		err = consume(ctx)
		if errors.Is(err, ErrRunnerStalled) {
			return ErrRunnerStalled
		}
		if err == nil {
			reported = false
		}
		if err != nil && ctx.Err() == nil {
			if !reported {
				log.Print("WAVEFORM_CONSUME_UNCONFIRMED")
				reported = true
			}
			timer := time.NewTimer(consumerBackoff)
			select {
			case <-ctx.Done():
			case <-timer.C:
			}
			timer.Stop()
		}
	}
	return nil
}
