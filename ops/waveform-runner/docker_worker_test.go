package runner

import (
	"context"
	"encoding/json"
	"io"
	"strings"
	"testing"
)

func TestDockerWorkerConfiguration(t *testing.T) {
	for _, image := range []string{"latest", "repo:latest", "sha256:bad"} {
		if _, err := NewDockerWorker(image, nil); err != ErrConfiguration {
			t.Fatal("mutable image accepted")
		}
	}
	if _, err := NewDockerWorker("sha256:"+strings.Repeat("a", 64), []string{"bad"}); err != ErrConfiguration {
		t.Fatal("bad allowlist accepted")
	}
	approved := []string{payload.VideoID}
	w, err := NewDockerWorker("sha256:"+strings.Repeat("a", 64), approved)
	if err != nil {
		t.Fatal(err)
	}
	approved[0] = "lmnopqrstuv"
	if w.approved[0] != payload.VideoID || w.network != workerNetwork {
		t.Fatal("protected config changed")
	}
	p := payload
	p.VideoID = "lmnopqrstuv"
	if _, err := w.Run(context.Background(), p); err != ErrPayload {
		t.Fatal("unapproved input reached Docker")
	}
}

func TestWorkerOutputProjection(t *testing.T) {
	valid := `{"durationMs":20,"bucketSizeMs":20,"peaks":{"version":1,"sample_rate":24000,"samples_per_pixel":480,"bits":8,"length":1,"data":[-1,1]}}`
	out, err := projectWorkerResult([]byte(valid), payload.VideoID)
	if err != nil {
		t.Fatal(err)
	}
	var value map[string]json.RawMessage
	json.Unmarshal(out, &value)
	if len(value) != 5 || string(value["generationVersion"]) != "1" || !strings.Contains(string(value["source"]), payload.VideoID) {
		t.Fatal("source/version not supplied by runner")
	}
	for _, body := range []string{`null`, valid + `{}`, strings.Replace(valid, `"durationMs":20`, `"durationMs":0`, 1), strings.Replace(valid, `"bucketSizeMs":20`, `"bucketSizeMs":null`, 1), strings.Replace(valid, `"peaks":`, `"source":{},"peaks":`, 1), strings.Replace(valid, `"durationMs":`, `"DurationMs":`, 1), strings.Repeat(" ", maxTerminalBody+1)} {
		if _, err := projectWorkerResult([]byte(body), payload.VideoID); err != ErrWorkUnconfirmed {
			t.Fatal("malformed output accepted")
		}
	}
}

func TestDockerOutputLimitCancels(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	b := &boundedOutput{maximum: 4, cancel: cancel}
	if n, err := b.Write([]byte("1234")); n != 4 || err != nil {
		t.Fatal("limit rejected")
	}
	if n, err := b.Write([]byte("5")); n != 0 || err == nil || ctx.Err() == nil || b.Len() != 4 {
		t.Fatal("overflow did not cancel without buffering")
	}
}

func TestDockerOutputCopyLimit(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	b := &boundedOutput{maximum: 4, cancel: cancel}
	_, err := io.Copy(b, struct{ io.Reader }{strings.NewReader("12345")})
	if err == nil || ctx.Err() == nil || b.Len() > 4 {
		t.Fatal("io.Copy bypassed output limit")
	}
}
