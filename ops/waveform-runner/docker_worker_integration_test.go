//go:build integration

package runner

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"io"
	"os"
	"strings"
	"testing"
	"time"
)

func TestDockerWorkerLifecycle(t *testing.T) {
	image := os.Getenv("P08_DOCKER_IMAGE")
	t.Setenv("DOCKER_HOST", "tcp://127.0.0.1:1")
	t.Setenv("DOCKER_CONTEXT", "must-not-inherit")
	t.Setenv("PROBE_SECRET", "must-not-inherit")
	if image == "" {
		t.Fatal("P08_DOCKER_IMAGE is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	call := func(args ...string) []byte {
		t.Helper()
		b, e := dockerCommand(ctx, nil, 4096, args...)
		if e != nil {
			t.Fatalf("Docker fixture command failed: %s", args[0])
		}
		return b
	}
	if len(bytes.TrimSpace(call("ps", "-a", "--filter", "name=^/"+workerName+"$", "--format", "{{.ID}}"))) != 0 {
		t.Fatal("reserved container exists; refusing to touch it")
	}
	w, err := NewDockerWorker(image, []string{payload.VideoID})
	if err != nil {
		t.Fatal(err)
	}
	w.network = "none"
	defer w.Cleanup(context.Background())
	var wav bytes.Buffer
	wav.WriteString("RIFF")
	binary.Write(&wav, binary.LittleEndian, uint32(36+48000))
	wav.WriteString("WAVEfmt ")
	for _, v := range []any{uint32(16), uint16(1), uint16(1), uint32(24000), uint32(48000), uint16(2), uint16(16)} {
		binary.Write(&wav, binary.LittleEndian, v)
	}
	wav.WriteString("data")
	binary.Write(&wav, binary.LittleEndian, uint32(48000))
	wav.Write(make([]byte, 48000))
	out, err := w.run(ctx, payload, bytes.NewReader(wav.Bytes()))
	if err != nil {
		t.Fatal("synthetic analysis failed", err)
	}
	var value struct {
		Duration int `json:"durationMs"`
	}
	json.Unmarshal(out, &value)
	if value.Duration != 1000 {
		t.Fatal("unexpected duration")
	}
	if len(bytes.TrimSpace(call("ps", "-a", "--filter", "name=^/"+workerName+"$", "--format", "{{.ID}}"))) != 0 {
		t.Fatal("container survived success")
	}
	runCtx, stop := context.WithCancel(ctx)
	reader, writer := io.Pipe()
	defer reader.Close()
	defer writer.Close()
	done := make(chan error, 1)
	go func() { _, e := w.run(runCtx, payload, reader); done <- e }()
	for {
		state, e := dockerCommand(ctx, nil, 4096, "inspect", "--format", "{{.State.Running}}", workerName)
		if e == nil && strings.TrimSpace(string(state)) == "true" {
			break
		}
		select {
		case e := <-done:
			t.Fatal("worker exited before cancellation", e)
		case <-ctx.Done():
			t.Fatal("container did not start")
		case <-time.After(50 * time.Millisecond):
		}
	}
	config := call("inspect", "--format", "{{json .HostConfig}}", workerName)
	var host struct {
		ReadonlyRootfs bool
		NetworkMode    string
		Dns            []string
		Memory         int64
		MemorySwap     int64
		NanoCpus       int64
		PidsLimit      int
		Binds          []string
		LogConfig      struct{ Type string }
		Tmpfs          map[string]string
	}
	if json.Unmarshal(config, &host) != nil || !host.ReadonlyRootfs || host.NetworkMode != "none" || strings.Join(host.Dns, ",") != "1.1.1.1,1.0.0.1" || host.Memory != 768*1024*1024 || host.MemorySwap != host.Memory || host.NanoCpus != 1e9 || host.PidsLimit != 32 || len(host.Binds) != 0 || host.LogConfig.Type != "none" || !strings.Contains(host.Tmpfs["/tmp"], "size=67108864") {
		t.Fatal("worker isolation/resource flags missing")
	}
	config = call("inspect", "--format", "{{json .Config}}", workerName)
	var runtimeConfig struct {
		User string
		Env  []string
	}
	if json.Unmarshal(config, &runtimeConfig) != nil || runtimeConfig.User != "65532:65532" || strings.Contains(string(config), "PROBE_SECRET") {
		t.Fatal("worker identity/environment boundary violated")
	}
	stop()
	writer.Close()
	select {
	case e := <-done:
		if e == nil || e == ErrRunnerStalled {
			t.Fatal("cancellation did not clean worker", e)
		}
	case <-ctx.Done():
		t.Fatal("cancelled worker did not finish")
	}
	if err := w.Cleanup(ctx); err != nil {
		t.Fatal("worker cleanup not confirmed")
	}
	// 같은 이름의 label 없는 컨테이너는 제거하지 않는다.
	id := strings.TrimSpace(string(call("create", "--name", workerName, "--network", "none", image)))
	defer dockerCommand(context.Background(), nil, 4096, "rm", "-f", id)
	if err := w.Cleanup(ctx); err != ErrRunnerStalled {
		t.Fatal("foreign container was not protected")
	}
	call("inspect", "--format", "{{.Id}}", id)
}
