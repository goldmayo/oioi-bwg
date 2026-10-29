package runner

import "context"

// ConsumeDeadLetterOne은 분석과 같은 슬롯을 사용한다. 새 attempt나 worker를 시작하지 않는다.
func (c *Consumer) ConsumeDeadLetterOne(ctx context.Context, jobs *JobClient, worker FixedWorker) error {
	if jobs == nil || worker == nil {
		return ErrConfiguration
	}
	d, err := c.PollDLQ(ctx)
	if err != nil || d == nil {
		return err
	}
	return c.ProcessDeadLetter(ctx, d, jobs, worker)
}

// ProcessDeadLetter는 전용 컨테이너 부재와 현재 attempt를 확인해 최종 실패를 제출한다.
// allowlist 철회 뒤에도 음원 접근 없이 Job만 회수한다. source 불일치는 정상 Job을 변경하지 않는다.
func (c *Consumer) ProcessDeadLetter(ctx context.Context, d *Delivery, jobs *JobClient, worker FixedWorker) error {
	if jobs == nil || worker == nil || d == nil || !d.deadLetter {
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
		if ctx.Err() != nil {
			return context.Cause(ctx)
		}
		ack, err := jobs.Complete(ctx, Terminal{JobID: d.JobID, AttemptID: job.AttemptID, Status: "FAILED", ErrorCode: "DLQ"})
		return c.confirmTerminal(ctx, d, jobs, ack, err)
	})
}
