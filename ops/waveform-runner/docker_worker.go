package runner

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"os/exec"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"
)

const workerName = "oioi-waveform-worker"
const workerLabel = "com.oioi.waveform.worker"
const workerNetwork = "oioi-waveform-egress"
const cleanupDeadline = 10 * time.Second
const workerDeadline = 120 * time.Second

var imageID = regexp.MustCompile(`^sha256:[a-f0-9]{64}$`)
var containerID = regexp.MustCompile(`^[a-f0-9]{64}$`)

type DockerWorker struct {
	image    string
	approved []string
	network  string
	mu       sync.Mutex
}

// 이미지 ID와 승인 목록은 보호된 배포 설정이다. 이미지는 미리 설치하며 자동 pull하지 않는다.
func NewDockerWorker(image string, approved []string) (*DockerWorker, error) {
	if !imageID.MatchString(image) {
		return nil, ErrConfiguration
	}
	for _, id := range approved {
		if !videoID.MatchString(id) {
			return nil, ErrConfiguration
		}
	}
	return &DockerWorker{image: image, approved: slices.Clone(approved), network: workerNetwork}, nil
}

func (w *DockerWorker) Cleanup(ctx context.Context) error {
	if !w.mu.TryLock() {
		return ErrRunnerStalled
	}
	defer w.mu.Unlock()
	return w.cleanup(ctx)
}

func (w *DockerWorker) cleanup(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, cleanupDeadline)
	defer cancel()
	find := func() (string, error) {
		b, e := dockerCommand(ctx, nil, 4096, "ps", "-a", "--no-trunc", "--filter", "name=^/"+workerName+"$", "--format", "{{.ID}}")
		return strings.TrimSpace(string(b)), e
	}
	id, err := find()
	if err != nil {
		return ErrRunnerStalled
	}
	if id == "" {
		return nil
	}
	if !containerID.MatchString(id) {
		return ErrRunnerStalled
	}
	label, err := dockerCommand(ctx, nil, 4096, "inspect", "--format", `{{index .Config.Labels "`+workerLabel+`"}}`, id)
	if err != nil {
		remaining, e := find()
		if e == nil && remaining == "" {
			return nil
		}
		return ErrRunnerStalled
	}
	if strings.TrimSpace(string(label)) != "1" {
		return ErrRunnerStalled
	}
	// 고정 ID만 정리한다. 자동 --rm과의 경합은 마지막 목록 조회로 확인한다.
	dockerCommand(ctx, nil, 4096, "stop", "--time", "2", id)
	dockerCommand(ctx, nil, 4096, "rm", "--force", id)
	remaining, err := find()
	if err != nil || remaining != "" {
		return ErrRunnerStalled
	}
	return nil
}

func (w *DockerWorker) Run(ctx context.Context, p Payload) (json.RawMessage, error) {
	return w.run(ctx, p, nil)
}

// stdin 경로는 패키지 내부 합성 입력 검증용이며 production Run은 --youtube만 사용한다.
func (w *DockerWorker) run(ctx context.Context, p Payload, stdin io.Reader) (result json.RawMessage, err error) {
	if !uuid7.MatchString(p.JobID) || !uuid7.MatchString(p.SongID) || !videoID.MatchString(p.VideoID) || !slices.Contains(w.approved, p.VideoID) {
		return nil, ErrPayload
	}
	if !w.mu.TryLock() {
		return nil, ErrWorkUnconfirmed
	}
	defer w.mu.Unlock()
	if err = w.cleanup(ctx); err != nil {
		return nil, err
	}
	defer func() {
		if e := w.cleanup(context.WithoutCancel(ctx)); e != nil {
			result, err = nil, ErrRunnerStalled
		}
	}()
	args := []string{"create", "--pull=never", "--rm", "--interactive", "--name", workerName, "--label", workerLabel + "=1",
		"--network", w.network, "--dns", "1.1.1.1", "--dns", "1.0.0.1", "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=67108864",
		"--memory", "768m", "--memory-swap", "768m", "--cpus", "1", "--pids-limit", "32", "--cap-drop", "ALL",
		"--security-opt", "no-new-privileges", "--log-driver", "none", "--ulimit", "core=0:0", "--user", "65532:65532",
		"--env", "WAVEFORM_YOUTUBE_APPROVED_VIDEO_IDS=" + p.VideoID, "--entrypoint", "/usr/local/bin/oioi-waveform", w.image}
	if stdin == nil {
		args = append(args, "--youtube", p.VideoID)
	}
	createCtx, cancel := context.WithTimeout(ctx, cleanupDeadline)
	id, createErr := dockerCommand(createCtx, nil, 4096, args...)
	cancel()
	// create 응답 유실은 늦은 생성 가능성을 배제할 수 없어 서비스 복구가 필요하다.
	if createErr != nil || !containerID.Match(bytes.TrimSpace(id)) {
		return nil, ErrRunnerStalled
	}
	runCtx, stop := context.WithTimeout(ctx, workerDeadline)
	defer stop()
	output, runErr := dockerCommand(runCtx, stdin, maxTerminalBody, "start", "--attach", "--interactive", strings.TrimSpace(string(id)))
	if runErr != nil {
		return nil, ErrWorkUnconfirmed
	}
	return projectWorkerResult(output, p.VideoID)
}

type boundedOutput struct {
	buffer  bytes.Buffer
	maximum int
	cancel  context.CancelFunc
}

func (b *boundedOutput) Len() int      { return b.buffer.Len() }
func (b *boundedOutput) Bytes() []byte { return b.buffer.Bytes() }
func (b *boundedOutput) Write(p []byte) (int, error) {
	if len(p) > b.maximum-b.Len() {
		b.cancel()
		return 0, ErrWorkUnconfirmed
	}
	return b.buffer.Write(p)
}

func dockerCommand(ctx context.Context, input io.Reader, maximum int, args ...string) ([]byte, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	cmd := exec.CommandContext(ctx, "/usr/bin/docker", append([]string{"--host", "unix:///var/run/docker.sock"}, args...)...)
	cmd.Env = []string{"PATH=/usr/bin:/bin", "HOME=/nonexistent", "DOCKER_CONFIG=/nonexistent"}
	output := &boundedOutput{maximum: maximum, cancel: cancel}
	cmd.Stdin = input
	cmd.Stdout = output
	cmd.Stderr = io.Discard
	cmd.WaitDelay = 2 * time.Second
	if cmd.Run() != nil {
		return nil, ErrWorkUnconfirmed
	}
	return output.Bytes(), nil
}

func projectWorkerResult(output []byte, id string) (json.RawMessage, error) {
	var data struct {
		DurationMS   int64           `json:"durationMs"`
		BucketSizeMS float64         `json:"bucketSizeMs"`
		Peaks        json.RawMessage `json:"peaks"`
	}
	decoder := json.NewDecoder(bytes.NewReader(output))
	decoder.DisallowUnknownFields()
	var fields map[string]json.RawMessage
	if len(output) > maxTerminalBody || decoder.Decode(&data) != nil || json.Unmarshal(output, &fields) != nil || len(fields) != 3 || fields["durationMs"] == nil || fields["bucketSizeMs"] == nil || fields["peaks"] == nil || data.DurationMS < 1 || data.DurationMS > 3600000 || data.BucketSizeMS <= 0 {
		return nil, ErrWorkUnconfirmed
	}
	peaks := bytes.TrimSpace(data.Peaks)
	if len(peaks) == 0 || peaks[0] != '{' {
		return nil, ErrWorkUnconfirmed
	}
	fields["source"], _ = json.Marshal(struct {
		Type string `json:"type"`
		ID   string `json:"id"`
	}{"youtube", id})
	fields["generationVersion"] = json.RawMessage(`1`)
	result, err := json.Marshal(fields)
	if err != nil || len(result) > maxTerminalBody {
		return nil, ErrWorkUnconfirmed
	}
	return result, nil
}
