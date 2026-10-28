package runner

import (
	"context"
	"errors"
	"time"
)

const heartbeatInterval = 30 * time.Second
const visibilityMargin = 30 * time.Second
const renewalDrain = publishDeadline + time.Second

var (
	ErrLeaseLost     = errors.New("WAVEFORM_LEASE_LOST")
	ErrRunnerStalled = errors.New("WAVEFORM_RUNNER_STALLED")
	errLeaseFinished = errors.New("WAVEFORM_LEASE_FINISHED")
)

// RunWithLease는 단일 실행 범위다. work는 신뢰된 코드이며 Job/source 확인을 대체하지 않는다.
// work는 ctx 취소 시 고정 worker를 중단·제거하고 정리가 끝난 뒤 반환해야 한다.
func (c *Consumer) RunWithLease(ctx context.Context, d *Delivery, work func(context.Context) error) error {
	return c.withLease(ctx, d, work, c.Renew)
}

func (c *Consumer) withLease(ctx context.Context, d *Delivery, work func(context.Context) error, renew func(context.Context, *Delivery) (time.Time, error)) (err error) {
	if d == nil || d.owner != c || !validReceipt(d.receipt) || work == nil {
		return ErrConsume
	}
	if !c.activity.CompareAndSwap(consumerIdle, consumerWorking) {
		return c.activityError()
	}
	state := consumerIdle
	defer func() { c.activity.Store(state) }()
	if !d.claimed.CompareAndSwap(false, true) {
		return ErrLeaseLost
	}
	if ctx.Err() != nil {
		return context.Cause(ctx)
	}
	now := time.Now()
	// 서버 시각은 한 번만 로컬 시계에 고정하고, 이후 기한은 monotonic time으로 감시한다.
	expires := now.Add(d.expireAfter.Sub(now))
	until := safeVisibility(now, d.readStarted, d.visibleAfter, expires)
	if d.readStarted.IsZero() || d.readStarted.After(now) || !until.After(now) {
		return ErrLeaseLost
	}
	child, cancel := context.WithCancelCause(ctx)
	finished, watched := make(chan struct{}), make(chan bool, 1)
	go func() { watched <- watchVisibility(child, cancel, finished, d, until, expires, renew) }()
	defer func() {
		close(finished)
		stalled := <-watched
		if stalled {
			state, err = consumerQuarantined, ErrRunnerStalled
		} else if cause := context.Cause(child); cause != errLeaseFinished {
			err = cause
		}
	}()
	return work(child)
}

type renewal struct {
	started, visible time.Time
	err              error
}

func watchVisibility(ctx context.Context, cancel context.CancelCauseFunc, finished <-chan struct{}, d *Delivery, until, expires time.Time, renew func(context.Context, *Delivery) (time.Time, error)) bool {
	ticker, timer := time.NewTicker(heartbeatInterval), time.NewTimer(time.Until(until))
	defer ticker.Stop()
	defer timer.Stop()
	var pending <-chan renewal
	var rpc context.Context
	var stop context.CancelFunc
	var timeout <-chan struct{}
	running := true
	for running {
		select {
		case <-ctx.Done():
			running = false
		case <-finished:
			if time.Now().Before(until) {
				cancel(errLeaseFinished)
			} else {
				cancel(ErrLeaseLost)
			}
			running = false
		case <-timer.C:
			cancel(ErrLeaseLost)
			running = false
		case <-timeout:
			cancel(ErrLeaseLost)
			running = false
		case <-ticker.C:
			if pending == nil {
				started := time.Now()
				if !started.Before(until) {
					cancel(ErrLeaseLost)
					running = false
					continue
				}
				rpc, stop = context.WithTimeout(ctx, publishDeadline)
				timeout = rpc.Done()
				result := make(chan renewal, 1)
				pending = result
				go func(call context.Context) {
					at, err := renew(call, d)
					result <- renewal{started, at, err}
				}(rpc)
			}
		case result := <-pending:
			now := time.Now()
			next := safeVisibility(now, result.started, result.visible, expires)
			failed := result.err != nil || rpc.Err() != nil || now.Sub(result.started) >= publishDeadline || !now.Before(until) || !next.After(now)
			stop()
			pending, timeout = nil, nil
			if failed {
				cancel(ErrLeaseLost)
				running = false
			} else {
				until = next
				timer.Reset(time.Until(until))
			}
		}
	}
	if stop != nil {
		stop()
	}
	if pending != nil {
		drain := time.NewTimer(renewalDrain)
		defer drain.Stop()
		select {
		case <-pending:
		case <-drain.C:
			return true
		}
	}
	return false
}

func safeVisibility(now, started, visible, expires time.Time) time.Time {
	remaining := min(visible.Sub(now), expires.Sub(now), started.Add(visibilitySeconds*time.Second).Sub(now)) - visibilityMargin
	return now.Add(remaining)
}

func (c *Consumer) activityError() error {
	if c.activity.Load() == consumerQuarantined {
		return ErrRunnerStalled
	}
	return ErrConsume
}
