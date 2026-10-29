package runner

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"sync/atomic"
	"time"

	"github.com/oracle/oci-go-sdk/v65/common"
	"github.com/oracle/oci-go-sdk/v65/queue"
)

const pollDeadline = 35 * time.Second
const visibilitySeconds = 180

var ErrConsume = errors.New("QUEUE_CONSUME_UNCONFIRMED")
var receiptToken = regexp.MustCompile(`^[A-Za-z0-9_-]+={0,2}$`)

// Delivery의 receipt는 메모리에서만 보관한다. 로그·worker·내부 API로 전달하지 않는다.
type Delivery struct {
	Payload
	owner                     *Consumer
	id                        int64
	receipt                   string
	deliveryCount             int
	visibleAfter, expireAfter time.Time
	readStarted               time.Time
	claimed                   atomic.Bool
	deadLetter                bool
}

type Consumer struct {
	client   queue.QueueClient
	queueID  string
	activity atomic.Int32
}

const (
	consumerIdle int32 = iota
	consumerPolling
	consumerWorking
	consumerQuarantined
)

// 기존 Instance Principal client를 공유하고 long poll의 HTTP 기한만 분리한다.
func NewConsumer(p *Publisher) (*Consumer, error) {
	if p == nil {
		return nil, ErrConfiguration
	}
	httpClient, ok := p.client.HTTPClient.(*http.Client)
	if !ok || httpClient == nil {
		return nil, ErrConfiguration
	}
	transport, ok := httpClient.Transport.(boundedTransport)
	if !ok {
		return nil, ErrConfiguration
	}
	transport.allowNoContent = true
	cloned := *httpClient
	cloned.Timeout, cloned.Transport = pollDeadline, transport
	client := p.client
	client.HTTPClient = &cloned
	return &Consumer{client: client, queueID: p.queueID}, nil
}

// Poll은 한 건만 수신한다. nil/nil만 정상 빈 poll이며 오류 뒤 자동 재시도하지 않는다.
func (c *Consumer) Poll(ctx context.Context) (*Delivery, error) {
	return c.poll(ctx, false)
}

// PollDLQ는 같은 실행 슬롯에서 내장 DLQ 한 건만 받는다. 일반 메시지의 delivery count로 DLQ를 추정하지 않는다.
func (c *Consumer) PollDLQ(ctx context.Context) (*Delivery, error) {
	return c.poll(ctx, true)
}

func (c *Consumer) destination(deadLetter bool) string {
	if deadLetter {
		return c.queueID + "-dlq"
	}
	return c.queueID
}

func (c *Consumer) poll(ctx context.Context, deadLetter bool) (*Delivery, error) {
	if !c.activity.CompareAndSwap(consumerIdle, consumerPolling) {
		return nil, c.activityError()
	}
	defer c.activity.Store(consumerIdle)
	started := time.Now()
	wait, deadline := 30, pollDeadline
	if deadLetter {
		wait, deadline = 0, publishDeadline
	}
	ctx, client, cancel := c.cancellableClient(ctx, deadline)
	defer cancel()
	policy := common.NoRetryPolicy()
	response, err := client.GetMessages(ctx, queue.GetMessagesRequest{
		QueueId: common.String(c.destination(deadLetter)), Limit: common.Int(1),
		TimeoutInSeconds: common.Int(wait), VisibilityInSeconds: common.Int(visibilitySeconds),
		RequestMetadata: common.RequestMetadata{RetryPolicy: &policy},
	})
	if err != nil || response.RawResponse == nil || response.RawResponse.StatusCode != 200 || response.Messages == nil || len(response.Messages) > 1 {
		return nil, ErrConsume
	}
	if len(response.Messages) == 0 {
		return nil, nil
	}
	m := response.Messages[0]
	if m.Id == nil || m.Receipt == nil || !validReceipt(*m.Receipt) || m.DeliveryCount == nil || *m.DeliveryCount < 1 || m.VisibleAfter == nil || m.VisibleAfter.IsZero() || m.ExpireAfter == nil || m.ExpireAfter.IsZero() || m.CreatedAt == nil || m.CreatedAt.IsZero() {
		return nil, ErrConsume
	}
	var fields map[string]json.RawMessage
	var value Payload
	if m.Content == nil || len(*m.Content) > 1024 || json.Unmarshal([]byte(*m.Content), &fields) != nil || len(fields) != 3 || fields["jobId"] == nil || fields["songId"] == nil || fields["videoId"] == nil || json.Unmarshal([]byte(*m.Content), &value) != nil || !uuid7.MatchString(value.JobID) || !uuid7.MatchString(value.SongID) || !videoID.MatchString(value.VideoID) {
		return nil, ErrPayload
	}
	return &Delivery{Payload: value, owner: c, id: *m.Id, receipt: *m.Receipt,
		deliveryCount: *m.DeliveryCount, visibleAfter: m.VisibleAfter.Time,
		expireAfter: m.ExpireAfter.Time, readStarted: started, deadLetter: deadLetter}, nil
}

// Renew는 응답을 확인한 경우에만 새 visibility를 반환한다. heartbeat/중단 정책은 소비 흐름이 소유한다.
func (c *Consumer) Renew(ctx context.Context, d *Delivery) (time.Time, error) {
	if d == nil || d.owner != c || !validReceipt(d.receipt) {
		return time.Time{}, ErrConsume
	}
	ctx, client, cancel := c.cancellableClient(ctx, publishDeadline)
	defer cancel()
	policy := common.NoRetryPolicy()
	response, err := client.UpdateMessage(ctx, queue.UpdateMessageRequest{
		QueueId: common.String(c.destination(d.deadLetter)), MessageReceipt: common.String(d.receipt),
		UpdateMessageDetails: queue.UpdateMessageDetails{VisibilityInSeconds: common.Int(visibilitySeconds)},
		RequestMetadata:      common.RequestMetadata{RetryPolicy: &policy},
	})
	if err != nil || response.RawResponse == nil || response.RawResponse.StatusCode != 200 || response.Id == nil || *response.Id != d.id || response.VisibleAfter == nil || response.VisibleAfter.IsZero() {
		return time.Time{}, ErrConsume
	}
	return response.VisibleAfter.Time, nil
}

// Delete는 terminal/명확한 삭제 확인 뒤에만 호출한다. 이 모듈은 DB 상태를 추정하지 않는다.
func (c *Consumer) Delete(ctx context.Context, d *Delivery) error {
	if d == nil || d.owner != c || !validReceipt(d.receipt) {
		return ErrConsume
	}
	ctx, client, cancel := c.cancellableClient(ctx, publishDeadline)
	defer cancel()
	policy := common.NoRetryPolicy()
	response, err := client.DeleteMessage(ctx, queue.DeleteMessageRequest{
		QueueId: common.String(c.destination(d.deadLetter)), MessageReceipt: common.String(d.receipt),
		RequestMetadata: common.RequestMetadata{RetryPolicy: &policy},
	})
	if err != nil || response.RawResponse == nil || response.RawResponse.StatusCode != 204 {
		return ErrConsume
	}
	return nil
}

// publisher와 같은 SDK 취소 분기 우회로 HTTP 기한·취소와 race 안전성을 유지한다.
func (c *Consumer) cancellableClient(ctx context.Context, timeout time.Duration) (context.Context, queue.QueueClient, context.CancelFunc) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	client := c.client
	client.HTTPClient = publishDispatcher{client.HTTPClient, ctx}
	return context.WithoutCancel(ctx), client, cancel
}

func validReceipt(value string) bool {
	return len(value) <= 2048 && receiptToken.MatchString(value)
}
