//go:build linux

package runner

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

func TestRuntimeConfiguration(t *testing.T) {
	for _, scenario := range []string{"valid", "unknown field", "trailing", "missing approvals", "invalid video", "mutable image", "wrong endpoint", "wrong queue", "bad port", "root group", "oversize"} {
		t.Run(scenario, func(t *testing.T) {
			value := map[string]any{"queueId": fixtureQueue, "endpoint": "https://cell-1.queue.messaging.ap-osaka-1.oci.oraclecloud.com", "consolePort": 3001, "socketGroup": 65534, "image": "sha256:" + strings.Repeat("a", 64), "approvedVideoIds": []string{}}
			switch scenario {
			case "unknown field":
				value["command"] = "sh"
			case "missing approvals":
				delete(value, "approvedVideoIds")
			case "invalid video":
				value["approvedVideoIds"] = []string{"https://example.org"}
			case "mutable image":
				value["image"] = "worker:latest"
			case "wrong endpoint":
				value["endpoint"] = "https://example.org"
			case "wrong queue":
				value["queueId"] = "other"
			case "bad port":
				value["consolePort"] = 0
			case "root group":
				value["socketGroup"] = 0
			}
			data, _ := json.Marshal(value)
			if scenario == "trailing" {
				data = append(data, []byte(" {}")...)
			}
			if scenario == "oversize" {
				data = append(data, []byte(strings.Repeat(" ", 4096))...)
			}
			path := filepath.Join(t.TempDir(), "config.json")
			if os.WriteFile(path, data, 0600) != nil {
				t.Fatal("fixture")
			}
			config, err := readRuntimeConfig(path)
			if (err == nil) != (scenario == "valid") {
				t.Fatalf("unexpected outcome %v", err)
			}
			if err == nil && (config.ConsolePort != 3001 || len(config.Approved) != 0) {
				t.Fatal("configuration projection")
			}
		})
	}
}

func TestProtectedRuntimeFile(t *testing.T) {
	for _, scenario := range []string{"secret", "readonly", "public", "symlink", "hardlink", "fifo", "oversize"} {
		t.Run(scenario, func(t *testing.T) {
			dir := t.TempDir()
			path := filepath.Join(dir, "token")
			target := filepath.Join(dir, "target")
			data := strings.Repeat("a", 64)
			if scenario == "oversize" {
				data += "extra"
			}
			if scenario == "fifo" {
				if syscall.Mkfifo(path, 0600) != nil {
					t.Fatal("fixture")
				}
			} else {
				if os.WriteFile(path, []byte(data), 0600) != nil {
					t.Fatal("fixture")
				}
				switch scenario {
				case "readonly":
					os.Chmod(path, 0400)
				case "public":
					os.Chmod(path, 0644)
				case "symlink":
					os.Rename(path, target)
					os.Symlink(target, path)
				case "hardlink":
					os.Link(path, target)
				}
			}
			got, err := readProtected(path, 65)
			accepted := scenario == "secret" || scenario == "readonly"
			if (err == nil) != accepted {
				t.Fatalf("unsafe file decision %v", err)
			}
			if accepted && string(got) != data {
				t.Fatal("file content changed")
			}
		})
	}
}
