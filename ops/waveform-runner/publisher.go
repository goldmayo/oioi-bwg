package runner

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net"
	"net/http"
	"regexp"
	"time"

	"github.com/oracle/oci-go-sdk/v65/common"
	"github.com/oracle/oci-go-sdk/v65/common/auth"
	"github.com/oracle/oci-go-sdk/v65/queue"
)

const publishDeadline = 2 * time.Second
const maxPublishResponse = 4096

var (
	ErrConfiguration = errors.New("RUNNER_CONFIGURATION_INVALID")
	ErrPayload       = errors.New("WAVEFORM_PAYLOAD_INVALID")
	ErrUnconfirmed   = errors.New("QUEUE_PUBLISH_UNCONFIRMED")
	uuid7            = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	videoID          = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)
	queueID          = regexp.MustCompile(`^ocid1\.queue\.oc1\.ap-osaka-1\.[a-z0-9]+$`)
	endpoint         = regexp.MustCompile(`^https://cell-[0-9]+\.queue\.messaging\.ap-osaka-1\.oci\.oraclecloud\.com$`)
)

// Payload는 기존 Queue 계약의 세 식별자만 표현한다.
type Payload struct {
	JobID   string `json:"jobId"`
	SongID  string `json:"songId"`
	VideoID string `json:"videoId"`
}

type Publisher struct {
	client  queue.QueueClient
	queueID string
}

// NewPublisher의 목적지는 보호된 배포 설정이다. 메시지나 HTTP 입력으로 받지 않는다.
// Instance Principal bootstrap은 시작 단계이며 이 함수는 작업 처리 중 호출하지 않는다.
func NewPublisher(id, host string) (*Publisher, error) {
	if !queueID.MatchString(id) || !endpoint.MatchString(host) {
		return nil, ErrConfiguration
	}
	provider, err := auth.InstancePrincipalConfigurationProvider()
	if err != nil {
		return nil, ErrConfiguration
	}
	return newPublisher(id, host, provider)
}

func newPublisher(id, host string, provider common.ConfigurationProvider) (*Publisher, error) {
	client, err := queue.NewQueueClientWithConfigurationProvider(provider)
	if err != nil {
		return nil, ErrConfiguration
	}
	client.Host = host
	client.HTTPClient = &http.Client{
		Timeout:       publishDeadline,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		Transport: boundedTransport{&http.Transport{
			DialContext:            (&net.Dialer{Timeout: publishDeadline}).DialContext,
			TLSClientConfig:        &tls.Config{MinVersion: tls.VersionTLS12},
			TLSHandshakeTimeout:    publishDeadline,
			MaxResponseHeaderBytes: maxPublishResponse,
			DisableCompression:     true,
			DisableKeepAlives:      true,
		}},
	}
	return &Publisher{client: client, queueID: id}, nil
}

// Publish 성공은 Put 성공만 뜻한다. socket ACK는 후속 enqueuedAt 저장 확인 뒤 반환한다.
// SDK 오류·응답 유실은 모두 불확실하다. 여기서 재시도·Job 실패·DB 변경을 하지 않는다.
func (p *Publisher) Publish(ctx context.Context, value Payload) error {
	if !uuid7.MatchString(value.JobID) || !uuid7.MatchString(value.SongID) || !videoID.MatchString(value.VideoID) {
		return ErrPayload
	}
	body, _ := json.Marshal(value)
	ctx, cancel := context.WithTimeout(ctx, publishDeadline)
	defer cancel()
	policy := common.NoRetryPolicy()
	// SDK v65.128.0 Retry는 취소 분기에서 공유 response를 잠금 없이 읽는다.
	// HTTP 취소는 유지하고 SDK는 그 요청의 종료 결과를 channel로 받도록 한다.
	client := p.client
	client.HTTPClient = publishDispatcher{p.client.HTTPClient, ctx}
	response, err := client.PutMessages(context.WithoutCancel(ctx), queue.PutMessagesRequest{
		QueueId: common.String(p.queueID),
		PutMessagesDetails: queue.PutMessagesDetails{
			Messages: []queue.PutMessagesDetailsEntry{{Content: common.String(string(body))}},
		},
		RequestMetadata: common.RequestMetadata{RetryPolicy: &policy},
	})
	if err != nil || response.RawResponse == nil || response.RawResponse.StatusCode != http.StatusOK ||
		len(response.Messages) != 1 || response.Messages[0].Id == nil {
		return ErrUnconfirmed
	}
	return nil
}

type publishDispatcher struct {
	base common.HTTPRequestDispatcher
	ctx  context.Context
}

func (d publishDispatcher) Do(request *http.Request) (*http.Response, error) {
	return d.base.Do(request.WithContext(d.ctx))
}

// SDK가 decode하기 전에 bytes를 제한한다. Queue HTTP에는 proxy env와 redirect를 쓰지 않는다.
type boundedTransport struct{ base *http.Transport }

func (t boundedTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	response, err := t.base.RoundTrip(request)
	if err != nil {
		return nil, err
	}
	mediaType, _, parseErr := mime.ParseMediaType(response.Header.Get("Content-Type"))
	if parseErr != nil || mediaType != "application/json" || response.Header.Get("Content-Encoding") != "" {
		response.Body.Close()
		return nil, ErrUnconfirmed
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxPublishResponse+1))
	response.Body.Close()
	if err != nil || len(body) > maxPublishResponse {
		return nil, ErrUnconfirmed
	}
	response.Body = io.NopCloser(bytes.NewReader(body))
	return response, nil
}
