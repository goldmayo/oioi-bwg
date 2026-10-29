package runner

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
)

const maxTerminalBody = 4 * 1024 * 1024

// Result는 source/generationVersion을 포함한 기존 WaveformData JSON이다.
// BBC/source의 도메인 검증과 저장·알림 transaction은 Console이 소유한다.
type Terminal struct {
	JobID     string          `json:"jobId"`
	AttemptID *string         `json:"attemptId"`
	Status    string          `json:"status"`
	Result    json.RawMessage `json:"result,omitempty"`
	ErrorCode string          `json:"errorCode,omitempty"`
}

type TerminalAck struct {
	JobID     string  `json:"jobId"`
	AttemptID *string `json:"attemptId"`
	Status    string  `json:"status"`
	Applied   bool    `json:"applied"`
}

// Complete는 한 번만 전송한다. 응답 유실은 조회/같은 attempt의 멱등 재제출로 확인한다.
// Applied=false만으로 삭제하지 않는다. receipt·worker 정리는 후속 소비 흐름의 책임이다.
func (c *JobClient) Complete(ctx context.Context, value Terminal) (TerminalAck, error) {
	if !uuid7.MatchString(value.JobID) || (value.AttemptID != nil && !uuid7.MatchString(*value.AttemptID)) {
		return TerminalAck{}, ErrPayload
	}
	switch value.Status {
	case "SUCCEEDED":
		result := bytes.TrimSpace(value.Result)
		if value.AttemptID == nil || value.ErrorCode != "" || len(result) == 0 || len(value.Result) > maxTerminalBody || result[0] != '{' || !json.Valid(result) {
			return TerminalAck{}, ErrPayload
		}
	case "FAILED":
		if len(value.Result) != 0 {
			return TerminalAck{}, ErrPayload
		}
		switch value.ErrorCode {
		case "ENQUEUE_FAILED", "PROCESSING_FAILED", "DLQ", "DELIVERY_EXPIRED", "SOURCE_CHANGED":
		default:
			return TerminalAck{}, ErrPayload
		}
	default:
		return TerminalAck{}, ErrPayload
	}
	body, err := json.Marshal(value)
	if err != nil || len(body) > maxTerminalBody {
		return TerminalAck{}, ErrPayload
	}
	data, err := c.exchange(ctx, http.MethodPost, value.JobID, "/terminal", body)
	if err != nil {
		return TerminalAck{}, err
	}
	var ack struct {
		JobID     string  `json:"jobId"`
		AttemptID *string `json:"attemptId"`
		Status    string  `json:"status"`
		Applied   *bool   `json:"applied"`
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var fields map[string]json.RawMessage
	if decoder.Decode(&ack) != nil || json.Unmarshal(data, &fields) != nil || len(fields) != 4 || ack.Applied == nil || ack.JobID != value.JobID || (ack.AttemptID != nil && !uuid7.MatchString(*ack.AttemptID)) {
		return TerminalAck{}, ErrJobAPI
	}
	for _, key := range []string{"jobId", "attemptId", "status", "applied"} {
		if fields[key] == nil {
			return TerminalAck{}, ErrJobAPI
		}
	}
	switch ack.Status {
	case "QUEUED", "RUNNING", "SUCCEEDED", "FAILED":
	default:
		return TerminalAck{}, ErrJobAPI
	}
	if *ack.Applied {
		sameAttempt := ack.AttemptID == nil && value.AttemptID == nil || ack.AttemptID != nil && value.AttemptID != nil && *ack.AttemptID == *value.AttemptID
		if !sameAttempt || (ack.Status != "SUCCEEDED" && ack.Status != "FAILED") || (value.Status == "FAILED" && ack.Status != "FAILED") {
			return TerminalAck{}, ErrJobAPI
		}
	}
	return TerminalAck{ack.JobID, ack.AttemptID, ack.Status, *ack.Applied}, nil
}
