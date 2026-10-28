package runner

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"regexp"
	"time"
)

var (
	ErrJobAPI      = errors.New("WAVEFORM_JOB_API_UNCONFIRMED")
	ErrJobNotFound = errors.New("WAVEFORM_JOB_NOT_FOUND")
	runnerToken    = regexp.MustCompile(`^[a-f0-9]{64}$`)
)

const jobDeadline = time.Second
const jobPath = "/api/internal/waveform-jobs/"

// Job은 기존 내부 DTO의 좁은 projection이다. DB row와 인증 정보를 받지 않는다.
type Job struct {
	ID         string  `json:"id"`
	SongID     string  `json:"songId"`
	VideoID    string  `json:"videoId"`
	Status     string  `json:"status"`
	AttemptID  *string `json:"attemptId"`
	EnqueuedAt *string `json:"enqueuedAt"`
}

type JobClient struct {
	origin, token string
	http          *http.Client
}

// port/token은 보호된 배포 설정이다. host·scheme·경로를 메시지에서 받지 않는다.
func NewJobClient(port int, token string) (*JobClient, error) {
	if port < 1 || port > 65535 || !runnerToken.MatchString(token) {
		return nil, ErrConfiguration
	}
	return &JobClient{
		origin: fmt.Sprintf("http://127.0.0.1:%d", port), token: token,
		http: &http.Client{
			Timeout:       jobDeadline,
			CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
			Transport: boundedTransport{&http.Transport{
				DialContext:            (&net.Dialer{Timeout: jobDeadline}).DialContext,
				MaxResponseHeaderBytes: maxPublishResponse,
				DisableCompression:     true, DisableKeepAlives: true,
			}},
		},
	}, nil
}

func (c *JobClient) Get(ctx context.Context, id string) (Job, error) {
	if !uuid7.MatchString(id) {
		return Job{}, ErrPayload
	}
	return c.request(ctx, http.MethodGet, id, "", nil)
}

// Put 성공을 확인한 시각만 전달한다. 기존 최초 확인 시각·RUNNING/terminal을 보존한다.
func (c *JobClient) RecordEnqueued(ctx context.Context, value Payload, at time.Time) (Job, error) {
	if !uuid7.MatchString(value.JobID) || !uuid7.MatchString(value.SongID) || !videoID.MatchString(value.VideoID) || at.IsZero() {
		return Job{}, ErrPayload
	}
	body, _ := json.Marshal(struct {
		Payload
		EnqueuedAt string `json:"enqueuedAt"`
	}{value, at.UTC().Format(time.RFC3339Nano)})
	job, err := c.request(ctx, http.MethodPost, value.JobID, "/enqueued", body)
	if err != nil {
		return Job{}, err
	}
	if job.SongID != value.SongID || job.VideoID != value.VideoID || job.EnqueuedAt == nil {
		return Job{}, ErrJobAPI
	}
	return job, nil
}

func (c *JobClient) request(ctx context.Context, method, id, suffix string, body []byte) (Job, error) {
	request, err := http.NewRequestWithContext(ctx, method, c.origin+jobPath+id+suffix, bytes.NewReader(body))
	if err != nil {
		return Job{}, ErrJobAPI
	}
	request.Header.Set("Authorization", "Bearer "+c.token)
	request.Header.Set("Accept", "application/json")
	if method == http.MethodPost {
		request.Header.Set("Content-Type", "application/json")
	}
	response, err := c.http.Do(request)
	if err != nil {
		return Job{}, ErrJobAPI
	}
	defer response.Body.Close()
	data, err := io.ReadAll(response.Body)
	if err != nil {
		return Job{}, ErrJobAPI
	}
	if response.StatusCode != http.StatusOK {
		var fault struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}
		if response.StatusCode == http.StatusNotFound && json.Unmarshal(data, &fault) == nil && fault.Code == "WAVEFORM_JOB_NOT_FOUND" && fault.Message != "" {
			return Job{}, ErrJobNotFound
		}
		return Job{}, ErrJobAPI
	}
	var job Job
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var fields map[string]json.RawMessage
	if decoder.Decode(&job) != nil || json.Unmarshal(data, &fields) != nil || fields["attemptId"] == nil || fields["enqueuedAt"] == nil || job.ID != id || !uuid7.MatchString(job.SongID) || !videoID.MatchString(job.VideoID) {
		return Job{}, ErrJobAPI
	}
	switch job.Status {
	case "QUEUED", "RUNNING", "SUCCEEDED", "FAILED":
	default:
		return Job{}, ErrJobAPI
	}
	if job.AttemptID != nil && !uuid7.MatchString(*job.AttemptID) {
		return Job{}, ErrJobAPI
	}
	if job.EnqueuedAt != nil {
		if _, err := time.Parse(time.RFC3339Nano, *job.EnqueuedAt); err != nil {
			return Job{}, ErrJobAPI
		}
	}
	return job, nil
}
