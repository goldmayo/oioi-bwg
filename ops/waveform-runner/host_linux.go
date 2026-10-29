//go:build linux

package runner

import (
	"errors"
	"net"
	"os"
	"path/filepath"
	"syscall"
)

var ErrService = errors.New("WAVEFORM_RUNNER_SERVICE_FAILED")

// HostSocket은 listener를 닫은 뒤에만 host 잠금을 해제한다. lock 파일은 삭제하지 않는다.
// 전용 경로는 설치기가 root 소유로 만들며, Console 그룹에는 쓰기 권한을 주지 않는다.
type HostSocket struct {
	Listener *net.UnixListener
	lock     *os.File
}

func OpenHostSocket(directory string, group int) (*HostSocket, error) {
	if !filepath.IsAbs(directory) || filepath.Clean(directory) != directory || group <= 0 || os.Geteuid() != 0 {
		return nil, ErrConfiguration
	}
	info, err := os.Lstat(directory)
	if err != nil || !info.IsDir() || info.Mode().Perm() != 0750 {
		return nil, ErrConfiguration
	}
	owner, ok := info.Sys().(*syscall.Stat_t)
	if !ok || owner.Uid != uint32(os.Geteuid()) || owner.Gid != uint32(group) {
		return nil, ErrConfiguration
	}
	fd, err := syscall.Open(filepath.Join(directory, "runner.lock"), syscall.O_CREAT|syscall.O_RDWR|syscall.O_CLOEXEC|syscall.O_NOFOLLOW|syscall.O_NONBLOCK, 0600)
	if err != nil {
		return nil, ErrConfiguration
	}
	file := os.NewFile(uintptr(fd), "runner.lock")
	accepted := false
	defer func() {
		if !accepted {
			file.Close()
		}
	}()
	stat, err := file.Stat()
	if err != nil {
		return nil, ErrConfiguration
	}
	lockOwner, ok := stat.Sys().(*syscall.Stat_t)
	if !ok || !stat.Mode().IsRegular() || stat.Mode().Perm() != 0600 || lockOwner.Uid != uint32(os.Geteuid()) || lockOwner.Nlink != 1 {
		return nil, ErrConfiguration
	}
	if syscall.Flock(fd, syscall.LOCK_EX|syscall.LOCK_NB) != nil {
		return nil, ErrService
	}
	path := filepath.Join(directory, "runner.sock")
	existing, err := os.Lstat(path)
	if err == nil {
		socketOwner, ok := existing.Sys().(*syscall.Stat_t)
		if !ok || existing.Mode()&os.ModeSocket == 0 || socketOwner.Uid != uint32(os.Geteuid()) || socketOwner.Gid != uint32(group) || existing.Mode().Perm() != 0660 {
			return nil, ErrConfiguration
		}
		// 이미 사용 중인 socket은 같은 이름이어도 제거하지 않는다.
		connection, dialErr := net.DialTimeout("unix", path, jobDeadline)
		if dialErr == nil {
			connection.Close()
			return nil, ErrService
		}
		if !os.IsNotExist(dialErr) && !errors.Is(dialErr, syscall.ECONNREFUSED) {
			return nil, ErrService
		}
		if os.Remove(path) != nil {
			return nil, ErrService
		}
	} else if !os.IsNotExist(err) {
		return nil, ErrConfiguration
	}
	listener, err := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
	if err != nil {
		return nil, ErrService
	}
	if os.Chown(path, os.Geteuid(), group) != nil || os.Chmod(path, 0660) != nil {
		listener.Close()
		return nil, ErrService
	}
	accepted = true
	return &HostSocket{Listener: listener, lock: file}, nil
}

func (h *HostSocket) Close() error {
	h.Listener.Close()
	// close가 flock도 해제한다. 파일을 unlink하면 별도 inode의 중복 잠금이 가능해진다.
	return h.lock.Close()
}
