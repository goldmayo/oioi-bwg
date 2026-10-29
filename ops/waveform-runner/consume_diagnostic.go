package runner

import "errors"

// 식별자·receipt·SDK 응답·내부 API 본문은 진단 오류에 담지 않는다.
type consumeDiagnostic struct {
	stage string
	cause error
}

func (e *consumeDiagnostic) Error() string { return "WAVEFORM_CONSUME_UNCONFIRMED" }
func (e *consumeDiagnostic) Unwrap() error { return e.cause }

func consumeFailure(stage string, err error) error {
	if err == nil {
		return nil
	}
	return &consumeDiagnostic{stage: stage, cause: err}
}

func consumeFailureStage(err error) string {
	var diagnostic *consumeDiagnostic
	if errors.As(err, &diagnostic) {
		switch diagnostic.stage {
		case "poll_response", "poll_fields", "poll_payload", "job_get", "delete":
			return diagnostic.stage
		}
	}
	switch {
	case errors.Is(err, ErrLeaseLost):
		return "lease"
	case errors.Is(err, ErrJobAPI):
		return "job_api"
	case errors.Is(err, ErrPayload):
		return "source"
	default:
		return "unknown"
	}
}
