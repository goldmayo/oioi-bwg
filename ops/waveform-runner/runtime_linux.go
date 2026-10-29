//go:build linux

package runner

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"os"
	"strings"
	"syscall"
)

type runtimeConfig struct {
	QueueID     string   `json:"queueId"`
	Endpoint    string   `json:"endpoint"`
	ConsolePort int      `json:"consolePort"`
	SocketGroup int      `json:"socketGroup"`
	Image       string   `json:"image"`
	Approved    []string `json:"approvedVideoIds"`
}

// Run은 설치기가 공급한 고정 경로만 읽는다. Queue 메시지·CLI·환경변수가 실행 설정을 바꾸지 않는다.
func Run(ctx context.Context) error {
	if os.Geteuid() != 0 {
		return ErrConfiguration
	}
	config, err := readRuntimeConfig("/etc/oioibawige/waveform-runner.json")
	if err != nil {
		return err
	}
	worker, err := NewDockerWorker(config.Image, config.Approved)
	if err != nil {
		return err
	}
	host, err := OpenHostSocket("/run/oioi-waveform", config.SocketGroup)
	if err != nil {
		return err
	}
	defer host.Close()
	if worker.Cleanup(ctx) != nil {
		return ErrRunnerStalled
	}
	token, err := readProtected("/run/oioi-waveform-private/token", 65)
	if err != nil {
		return err
	}
	jobs, err := NewJobClient(config.ConsolePort, strings.TrimSuffix(string(token), "\n"))
	if err != nil {
		return err
	}
	publisher, err := NewPublisher(config.QueueID, config.Endpoint)
	if err != nil {
		return err
	}
	consumer, err := NewConsumer(publisher)
	if err != nil {
		return err
	}
	return Serve(ctx, host.Listener, jobs, publisher, consumer, worker, config.Approved)
}

func readRuntimeConfig(path string) (runtimeConfig, error) {
	data, err := readProtected(path, 4096)
	if err != nil {
		return runtimeConfig{}, err
	}
	var value runtimeConfig
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&value) != nil || decoder.Decode(new(any)) != io.EOF || !queueID.MatchString(value.QueueID) || !endpoint.MatchString(value.Endpoint) || value.ConsolePort < 1 || value.ConsolePort > 65535 || value.SocketGroup <= 0 || value.Approved == nil {
		return runtimeConfig{}, ErrConfiguration
	}
	if _, err := NewDockerWorker(value.Image, value.Approved); err != nil {
		return runtimeConfig{}, ErrConfiguration
	}
	return value, nil
}

// 읽기 전용이어도 FIFO/symlink/hardlink·완화된 권한의 파일은 거절한다.
func readProtected(path string, limit int64) ([]byte, error) {
	fd, err := syscall.Open(path, syscall.O_RDONLY|syscall.O_CLOEXEC|syscall.O_NOFOLLOW|syscall.O_NONBLOCK, 0)
	if err != nil {
		return nil, ErrConfiguration
	}
	file := os.NewFile(uintptr(fd), path)
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return nil, ErrConfiguration
	}
	owner, ok := info.Sys().(*syscall.Stat_t)
	if !ok || !info.Mode().IsRegular() || owner.Uid != 0 || owner.Nlink != 1 || (info.Mode().Perm() != 0600 && info.Mode().Perm() != 0400) {
		return nil, ErrConfiguration
	}
	data, err := io.ReadAll(io.LimitReader(file, limit+1))
	if err != nil || len(data) > int(limit) {
		return nil, ErrConfiguration
	}
	return data, nil
}

// CleanupStopped는 systemd 종료 후 credential 없이 고정 컨테이너만 정리한다.
func CleanupStopped(ctx context.Context) error {
	if os.Geteuid() != 0 {
		return ErrConfiguration
	}
	config, err := readRuntimeConfig("/etc/oioibawige/waveform-runner.json")
	if err != nil {
		return err
	}
	worker, err := NewDockerWorker(config.Image, config.Approved)
	if err != nil {
		return err
	}
	host, err := OpenHostSocket("/run/oioi-waveform", config.SocketGroup)
	if err != nil {
		return err
	}
	defer host.Close()
	return worker.Cleanup(ctx)
}
