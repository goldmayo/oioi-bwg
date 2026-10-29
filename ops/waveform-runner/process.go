package runner

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
)

var ErrWorkUnconfirmed = errors.New("WAVEFORM_WORK_UNCONFIRMED")

// FixedWorker는 보호된 고정 실행기다. 메시지에서 command/image/env를 받지 않는다.
// Cleanup은 잔존 container 부재를 확인한다. Run은 취소를 포함해 정리 후에만 반환한다.
// 정리를 확인하지 못하면 ErrRunnerStalled를 반환해야 하며 호출 기한은 구현체가 제한한다.
// Run 결과는 source/generationVersion을 포함한 WaveformData다.
type FixedWorker interface {
	Cleanup(context.Context) error
	Run(context.Context, Payload) (json.RawMessage, error)
}

// ConsumeOne은 한 번 poll하고 작업을 끝낸다. 재시도 루프나 메모리 대기열을 만들지 않는다.
func (c *Consumer) ConsumeOne(ctx context.Context, jobs *JobClient, worker FixedWorker, approved []string) error {
	if jobs == nil || worker == nil {
		return ErrConfiguration
	}
	d, err := c.Poll(ctx)
	if err != nil || d == nil {
		return err
	}
	return c.Process(ctx, d, jobs, worker, approved)
}

// Process는 수신한 한 건을 lease 안에서 처리한다. 일시 오류는 재전달에 맡긴다.
// approved는 보호된 운영 설정이며 Queue가 변경할 수 없다.
func (c *Consumer) Process(ctx context.Context, d *Delivery, jobs *JobClient, worker FixedWorker, approved []string) error {
	if jobs == nil || worker == nil || d == nil || d.deadLetter {
		return ErrConfiguration
	}
	return c.RunWithLease(ctx, d, func(ctx context.Context) error {
		if err := worker.Cleanup(ctx); err != nil {
			return ErrRunnerStalled
		}
		job, err := jobs.Get(ctx, d.JobID)
		if err == ErrJobNotFound {
			return c.Delete(ctx, d)
		}
		if err != nil {
			return err
		}
		if job.SongID != d.SongID || job.VideoID != d.VideoID {
			return ErrPayload
		}
		if terminalStatus(job.Status) {
			return c.Delete(ctx, d)
		}
		if !slices.Contains(approved, d.VideoID) {
			return ErrPayload
		}
		start, err := jobs.Start(ctx, d.Payload, job.AttemptID)
		if err != nil {
			return err
		}
		if !start.Started {
			return ErrWorkUnconfirmed
		}
		if ctx.Err() != nil {
			return context.Cause(ctx)
		}
		result, err := worker.Run(ctx, d.Payload)
		if errors.Is(err, ErrRunnerStalled) {
			return ErrRunnerStalled
		}
		if ctx.Err() != nil {
			return context.Cause(ctx)
		}
		if err != nil {
			return ErrWorkUnconfirmed
		}
		ack, err := jobs.Complete(ctx, Terminal{JobID: d.JobID, AttemptID: start.AttemptID, Status: "SUCCEEDED", Result: result})
		return c.confirmTerminal(ctx, d, jobs, ack, err)
	})
}

func terminalStatus(status string) bool { return status == "SUCCEEDED" || status == "FAILED" }

// confirmTerminal은 DB terminal/명확한 삭제가 확인된 뒤에만 receipt를 삭제한다.
func (c *Consumer) confirmTerminal(ctx context.Context, d *Delivery, jobs *JobClient, ack TerminalAck, err error) error {
	if err == nil && terminalStatus(ack.Status) {
		return c.Delete(ctx, d)
	}
	if err == ErrJobNotFound {
		return c.Delete(ctx, d)
	}
	if err != nil && err != ErrJobAPI {
		return err
	}
	// 응답 유실·이전 attempt 거절 뒤에도 같은 Job의 정본만 재확인한다.
	current, lookupErr := jobs.Get(ctx, d.JobID)
	if lookupErr == ErrJobNotFound {
		return c.Delete(ctx, d)
	}
	if lookupErr != nil {
		return lookupErr
	}
	if current.SongID != d.SongID || current.VideoID != d.VideoID {
		return ErrPayload
	}
	if terminalStatus(current.Status) {
		return c.Delete(ctx, d)
	}
	return ErrWorkUnconfirmed
}
