"""고정 ARM64 이미지의 합성 입력·기한·종료 검사. 음원은 container 밖으로 보내지 않는다."""
import json
import re
import shlex
import struct
import subprocess
import sys
import time
import uuid

image = sys.argv[1]
assert re.fullmatch(r"sha256:[a-f0-9]{64}", image), "use an immutable loaded image ID"
name = f"p08-waveform-{uuid.uuid4()}"
flags = ["--rm", "--name", name, "--read-only", "--network", "none",
         "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=67108864", "--memory", "768m",
         "--memory-swap", "768m", "--cpus", "1", "--pids-limit", "32", "--ulimit", "core=0:0",
         "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--log-driver", "none"]
worker = "/usr/local/bin/oioi-waveform"


def docker(*args, check=True, timeout=160):
    return subprocess.run(["docker", *args], capture_output=True, text=True, check=check, timeout=timeout)


def shell(script, check=True):
    return docker("exec", name, "sh", "-c", script, check=check)


def clean():
    result = shell('set -e; test -z "$(ls -A /tmp)"; for path in /proc/[0-9]*/comm; do '
                   'read -r command < "$path" || continue; '
                   'case "$command" in ffmpeg|audiowaveform) exit 1;; esac; done')
    assert result.returncode == 0 and not result.stderr


def generator(seconds):
    anchors = [0.24, seconds / 2 + 0.12, seconds - 0.32]
    terms = "+".join(f"between(n\\,{round(a * 48000)}\\,{round(a * 48000) + 239})" for a in anchors)
    source = f"aevalsrc=if({terms}\\,0.5\\,0):s=48000:d={seconds}"
    frames = round(seconds * 48000)
    header = struct.pack("<4sI4s4sIHHIIHH4sI", b"RIFF", 36 + frames * 4, b"WAVE", b"fmt ",
                         16, 1, 2, 48000, 192000, 4, 16, b"data", frames * 4)
    escaped = "".join(f"\\{byte:03o}" for byte in header)
    # 알려진 RIFF 길이를 먼저 쓴다. ffmpeg의 unknown-length WAV는 -xerror에서 corrupt로 거절된다.
    return (f"{{ printf {shlex.quote(escaped)}; exec ffmpeg -nostdin -hide_banner -loglevel error "
            f"-threads 1 -filter_threads 1 -f lavfi -i {shlex.quote(source)} -t {seconds} "
            "-ac 2 -threads 1 -f s16le pipe:1; }")


def run(seconds):
    started = time.monotonic()
    script = ("mkfifo /tmp/input; " + generator(seconds) + " > /tmp/input 2>/dev/null & source=$!; "
              f"{worker} < /tmp/input > /tmp/result.json 2>/tmp/error; status=$?; "
              'kill "$source" 2>/dev/null || true; wait "$source" 2>/dev/null || true; '
              'cat /tmp/result.json; cat /tmp/error >&2; rm /tmp/input /tmp/result.json /tmp/error; exit "$status"')
    result = shell(script, check=False)
    clean()
    if seconds > 3600:
        assert result.returncode != 0 and not result.stdout
        assert result.stderr == "WAVEFORM_ANALYSIS_FAILED\n"
        return {"case": "over-limit", "rejected": True}
    assert result.returncode == 0 and not result.stderr, result.stderr
    data = json.loads(result.stdout)
    assert data["durationMs"] == round(seconds * 1000) and data["bucketSizeMs"] == 20
    peaks = data["peaks"]
    offsets = []
    for anchor in [0.24, seconds / 2 + 0.12, seconds - 0.32]:
        expected = int(anchor / 0.02)
        nearby = range(max(0, expected - 2), min(peaks["length"], expected + 3))
        actual = max(nearby, key=lambda i: peaks["data"][i * 2 + 1])
        assert peaks["data"][actual * 2 + 1] > 20
        offsets.append(round(actual * 20 - anchor * 1000, 3))
    assert max(abs(value) for value in offsets) <= 20 and max(offsets) - min(offsets) <= 20
    return {"seconds": seconds, "generatorAndWorkerElapsedSeconds": round(time.monotonic() - started, 3),
            "jsonBytes": len(result.stdout), "anchorOffsetsMs": offsets}


def blocked(terminate):
    started = time.monotonic()
    script = (f"mkfifo /tmp/input; exec 3<>/tmp/input; {worker} <&3 > /tmp/result 2>/tmp/error & pid=$!; "
              + ('sleep 0.3; kill -TERM "$pid"; ' if terminate else "")
              + 'wait "$pid"; status=$?; cat /tmp/result; cat /tmp/error >&2; '
              'exec 3<&-; rm /tmp/input /tmp/result /tmp/error; exit "$status"')
    result = shell(script, check=False)
    elapsed = time.monotonic() - started
    assert result.returncode != 0 and not result.stdout
    assert result.stderr == "WAVEFORM_ANALYSIS_FAILED\n"
    assert elapsed < 5 if terminate else 119 <= elapsed <= 125
    clean()
    return {"case": "SIGTERM" if terminate else "120-second-timeout", "elapsedSeconds": round(elapsed, 3)}


def blocked_output():
    script = ("mkfifo /tmp/input /tmp/output; exec 3<>/tmp/output; " + generator(3600)
              + " > /tmp/input 2>/dev/null & source=$!; "
              + f"{worker} < /tmp/input >&3 2>/tmp/error & pid=$!; "
              'wait "$source"; sleep 0.3; kill -TERM "$pid"; wait "$pid"; status=$?; '
              'cat /tmp/error >&2; exec 3<&-; rm /tmp/input /tmp/output /tmp/error; exit "$status"')
    result = shell(script, check=False)
    assert result.returncode != 0 and not result.stdout and result.stderr == "WAVEFORM_ANALYSIS_FAILED\n"
    clean()
    return {"case": "SIGTERM-blocked-result-output", "rejected": True}


try:
    docker("run", "-d", *flags, "--entrypoint", "sleep", image, "600")
    state = json.loads(docker("inspect", name).stdout)[0]
    host = state["HostConfig"]
    assert host["ReadonlyRootfs"] and host["NetworkMode"] == "none" and state["Mounts"] == []
    assert host["Memory"] == host["MemorySwap"] == 768 * 1024 * 1024 and host["NanoCpus"] == 1_000_000_000
    assert host["PidsLimit"] == 32 and host["LogConfig"]["Type"] == "none"
    assert state["Config"]["User"] == "65532:65532"
    shell('test "$(uname -m)" = aarch64 && ! command -v python3 && '
          'test "$(cat /sys/fs/cgroup/memory.swap.max)" = 0')
    cases = [run(3.013), run(240), run(3600), run(3601)]
    for script in [f"printf 'invalid WAV' | {worker}", f"{worker} https://example.test/audio"]:
        result = shell(script, check=False)
        assert result.returncode != 0 and not result.stdout and result.stderr == "WAVEFORM_ANALYSIS_FAILED\n"
        clean()
    cases.extend([blocked(True), blocked_output(), blocked(False)])
    peak = int(shell("cat /sys/fs/cgroup/memory.peak").stdout)
    assert shell("cat /sys/fs/cgroup/memory.swap.current").stdout.strip() == "0"
    docker("rm", "-f", name)
    for signal in ["TERM", "KILL"]:
        process = subprocess.Popen(["docker", "run", "-i", *flags, image], stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        time.sleep(1)
        docker("kill", "--signal", signal, name)
        output, error = process.communicate(timeout=5)
        assert process.returncode == (1 if signal == "TERM" else 137) and not output
        assert not error if signal == "KILL" else error == b"WAVEFORM_ANALYSIS_FAILED\n"
        assert docker("inspect", name, check=False).returncode != 0
    print(json.dumps({"image": image, "cases": cases, "memoryPeakBytes": peak,
                      "tmpfsFilesAfter": 0, "persistentMounts": 0, "pid1TermAndKillRemoved": True}))
finally:
    docker("rm", "-f", name, check=False)
