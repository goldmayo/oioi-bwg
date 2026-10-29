package runner

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
)

type StartAck struct {
	Job
	Started bool `json:"started"`
}

// Start는 유효 receipt와 이전 worker 정리를 확인한 호출자만 사용한다.
// 오류/Started=false는 실행 허가가 아니다. 응답 유실 시 재시도하지 않고 조회로 확인한다.
func (c *JobClient) Start(ctx context.Context, value Payload, expectedAttemptID *string) (StartAck, error) {
	if !uuid7.MatchString(value.JobID) || !uuid7.MatchString(value.SongID) || !videoID.MatchString(value.VideoID) || (expectedAttemptID != nil && !uuid7.MatchString(*expectedAttemptID)) {
		return StartAck{}, ErrPayload
	}
	body, _ := json.Marshal(struct {
		Payload
		ExpectedAttemptID *string `json:"expectedAttemptId"`
	}{value, expectedAttemptID})
	data, err := c.exchange(ctx, http.MethodPost, value.JobID, "/start", body)
	if err != nil {
		return StartAck{}, err
	}
	var ack struct {
		Job
		Started *bool `json:"started"`
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var fields map[string]json.RawMessage
	if decoder.Decode(&ack) != nil || json.Unmarshal(data, &fields) != nil || len(fields) != 7 || fields["started"] == nil || ack.Started == nil || !validJob(ack.Job, value.JobID, fields) || ack.SongID != value.SongID || ack.VideoID != value.VideoID {
		return StartAck{}, ErrJobAPI
	}
	if *ack.Started && (ack.Status != "RUNNING" || ack.AttemptID == nil || (expectedAttemptID != nil && *ack.AttemptID == *expectedAttemptID)) {
		return StartAck{}, ErrJobAPI
	}
	return StartAck{ack.Job, *ack.Started}, nil
}
