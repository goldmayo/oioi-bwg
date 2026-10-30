package runner

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestConsumeDiagnosticRedaction(t *testing.T) {
	for _, stage := range []string{"poll_response", "poll_fields", "poll_payload", "job_get", "delete"} {
		err := consumeFailure(stage, ErrConsume)
		if !errors.Is(err, ErrConsume) || consumeFailureStage(err) != stage || err.Error() != "WAVEFORM_CONSUME_UNCONFIRMED" {
			t.Fatal("diagnostic lost stage, error identity or redaction")
		}
	}
	private := "PRIVATE_RECEIPT_TOKEN_RESPONSE"
	err := consumeFailure(private, errors.New(private))
	if consumeFailureStage(err) != "unknown" || strings.Contains(err.Error(), private) {
		t.Fatal("untrusted diagnostic escaped allowlist")
	}
	if consumeFailure("delete", nil) != nil || consumeFailureStage(ErrLeaseLost) != "lease" {
		t.Fatal("success or lease classification changed")
	}
}

func TestPollDiagnosticStages(t *testing.T) {
	for _, stage := range []string{"poll_response", "poll_fields", "poll_payload"} {
		t.Run(stage, func(t *testing.T) {
			m := message()
			if stage == "poll_fields" {
				m["receipt"] = "PRIVATE/INVALID"
			}
			if stage == "poll_payload" {
				m["content"] = "PRIVATE_INVALID_JSON"
			}
			c, _ := consumerFixture(t, func(w http.ResponseWriter, r *http.Request) {
				if stage == "poll_response" {
					w.WriteHeader(500)
				}
				io.WriteString(w, batch(m))
			})
			_, err := c.Poll(context.Background())
			if consumeFailureStage(err) != stage {
				t.Fatalf("stage=%s", consumeFailureStage(err))
			}
		})
	}
}
