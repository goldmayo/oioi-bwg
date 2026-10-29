package runner

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"syscall"
	"testing"
	"time"
)

func hostDirectory(t *testing.T) (string, int) {
	t.Helper()
	dir := t.TempDir()
	group := os.Getegid()
	if group == 0 {
		group = 65534
	}
	if err := os.Chown(dir, os.Geteuid(), group); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(dir, 0750); err != nil {
		t.Fatal(err)
	}
	return dir, group
}

func TestHostLockAndSocketLifecycle(t *testing.T) {
	dir, group := hostDirectory(t)
	h, err := OpenHostSocket(dir, group)
	if err != nil {
		t.Fatal(err)
	}
	defer h.Close()
	path := filepath.Join(dir, "runner.sock")
	info, err := os.Lstat(path)
	if err != nil || info.Mode().Perm() != 0660 || info.Sys().(*syscall.Stat_t).Gid != uint32(group) {
		t.Fatal("socket DAC")
	}
	if second, e := OpenHostSocket(dir, group); e == nil {
		second.Close()
		t.Fatal("duplicate lock")
	}
	connection, err := net.Dial("unix", path)
	if err != nil {
		t.Fatal("duplicate attempt destroyed live socket")
	}
	connection.Close()
	lockBefore, err := os.Stat(filepath.Join(dir, "runner.lock"))
	if err != nil {
		t.Fatal(err)
	}
	if err = h.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err = os.Lstat(path); !os.IsNotExist(err) {
		t.Fatal("socket remains after close")
	}
	next, err := OpenHostSocket(dir, group)
	if err != nil {
		t.Fatal(err)
	}
	defer next.Close()
	lockAfter, err := os.Stat(filepath.Join(dir, "runner.lock"))
	if err != nil || !os.SameFile(lockBefore, lockAfter) {
		t.Fatal("lock inode changed")
	}
}

func TestHostStaleAndForeignSocket(t *testing.T) {
	for _, live := range []bool{false, true} {
		t.Run(map[bool]string{false: "stale", true: "live"}[live], func(t *testing.T) {
			dir, group := hostDirectory(t)
			path := filepath.Join(dir, "runner.sock")
			prior, err := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
			if err != nil {
				t.Fatal(err)
			}
			prior.SetUnlinkOnClose(false)
			defer prior.Close()
			if os.Chown(path, os.Geteuid(), group) != nil || os.Chmod(path, 0660) != nil {
				t.Fatal("fixture permissions")
			}
			if !live {
				prior.Close()
			}
			h, err := OpenHostSocket(dir, group)
			if live {
				if err == nil {
					h.Close()
					t.Fatal("removed live socket")
				}
				connection, e := net.Dial("unix", path)
				if e != nil {
					t.Fatal("foreign listener lost")
				}
				connection.Close()
			} else {
				if err != nil {
					t.Fatal(err)
				}
				h.Close()
			}
		})
	}
}

func TestHostRejectsUnsafeFiles(t *testing.T) {
	for _, kind := range []string{"directory writable", "directory symlink", "wrong group", "lock symlink", "lock hardlink", "lock permissions", "lock fifo", "socket regular", "socket symlink", "socket permissions"} {
		t.Run(kind, func(t *testing.T) {
			dir, group := hostDirectory(t)
			lock := filepath.Join(dir, "runner.lock")
			socket := filepath.Join(dir, "runner.sock")
			write := func(path string, mode os.FileMode) {
				if os.WriteFile(path, []byte("preserve"), mode) != nil {
					t.Fatal("fixture")
				}
			}
			switch kind {
			case "directory writable":
				os.Chmod(dir, 0770)
			case "directory symlink":
				link := filepath.Join(t.TempDir(), "link")
				if os.Symlink(dir, link) != nil {
					t.Fatal("fixture")
				}
				dir = link
			case "wrong group":
				group++
			case "lock symlink":
				target := filepath.Join(dir, "target")
				write(target, 0600)
				os.Symlink(target, lock)
			case "lock hardlink":
				target := filepath.Join(dir, "target")
				write(target, 0600)
				os.Link(target, lock)
			case "lock permissions":
				write(lock, 0644)
			case "lock fifo":
				syscall.Mkfifo(lock, 0600)
			case "socket regular":
				write(socket, 0660)
			case "socket symlink":
				target := filepath.Join(dir, "target")
				write(target, 0600)
				os.Symlink(target, socket)
			case "socket permissions":
				l, e := net.ListenUnix("unix", &net.UnixAddr{Name: socket, Net: "unix"})
				if e != nil {
					t.Fatal(e)
				}
				defer l.Close()
				os.Chmod(socket, 0666)
			}
			if h, e := OpenHostSocket(dir, group); e == nil {
				h.Close()
				t.Fatal("unsafe path accepted")
			}
			if kind == "socket regular" {
				data, _ := os.ReadFile(socket)
				if string(data) != "preserve" {
					t.Fatal("foreign file removed")
				}
			}
		})
	}
}

// 별도 프로세스의 강제 종료가 flock을 풀고 남은 socket을 다음 기동이 회수하는지 확인한다.
func TestHostCrashRecovery(t *testing.T) {
	dir, group := hostDirectory(t)
	executable, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	child := exec.CommandContext(ctx, executable, "-test.run=^TestHostCrashHelper$")
	child.Env = []string{"P08_HOST_HELPER=" + dir, "P08_HOST_GROUP=" + strconv.Itoa(group)}
	output, err := child.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err = child.Start(); err != nil {
		t.Fatal(err)
	}
	defer child.Process.Kill()
	scanner := bufio.NewScanner(output)
	if !scanner.Scan() || scanner.Text() != "ready" {
		child.Wait()
		t.Fatal("child did not acquire socket")
	}
	if other, e := OpenHostSocket(dir, group); e == nil {
		other.Close()
		t.Fatal("cross-process lock failed")
	}
	if err = child.Process.Kill(); err != nil {
		t.Fatal(err)
	}
	child.Wait()
	if _, err = os.Lstat(filepath.Join(dir, "runner.sock")); err != nil {
		t.Fatal("crash fixture did not leave socket")
	}
	next, err := OpenHostSocket(dir, group)
	if err != nil {
		t.Fatal(err)
	}
	next.Close()
}

func TestHostCrashHelper(t *testing.T) {
	dir := os.Getenv("P08_HOST_HELPER")
	if dir == "" {
		return
	}
	group, err := strconv.Atoi(os.Getenv("P08_HOST_GROUP"))
	if err != nil {
		t.Fatal(err)
	}
	host, err := OpenHostSocket(dir, group)
	if err != nil {
		t.Fatal(err)
	}
	defer host.Close()
	fmt.Println("ready")
	time.Sleep(10 * time.Second)
}
