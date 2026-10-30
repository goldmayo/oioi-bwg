package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	runner "github.com/goldmayo/oioi-bwg/ops/waveform-runner"
)

func main() {
	os.Clearenv()
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()
	var err error
	switch {
	case len(os.Args) == 1:
		err = runner.Run(ctx)
	case len(os.Args) == 2 && os.Args[1] == "cleanup":
		err = runner.CleanupStopped(ctx)
	default:
		err = runner.ErrConfiguration
	}
	if err != nil && !errors.Is(err, context.Canceled) {
		code := "WAVEFORM_RUNNER_FAILED"
		switch {
		case errors.Is(err, runner.ErrConfiguration):
			code = "RUNNER_CONFIGURATION_INVALID"
		case errors.Is(err, runner.ErrRunnerStalled):
			code = "WAVEFORM_RUNNER_STALLED"
		case errors.Is(err, runner.ErrService):
			code = "WAVEFORM_RUNNER_SERVICE_FAILED"
		}
		fmt.Fprintln(os.Stderr, code)
		os.Exit(1)
	}
}
