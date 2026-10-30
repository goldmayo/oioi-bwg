"""외부 영상 없이 실제 CLI의 로컬 HTTP pipe와 Rust의 acquisition 경계를 검증한다."""
import json
import re
import statistics
import struct
import subprocess
import sys
import time
import uuid

image = sys.argv[1]
assert re.fullmatch(r"sha256:[a-f0-9]{64}", image)
worker = "/usr/local/bin/oioi-waveform"
downloader = "/opt/yt-dlp/yt-dlp_linux_aarch64"
name = f"p08-acquisition-{uuid.uuid4()}"
flags = ["--read-only", "--network", "none", "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=67108864",
         "--memory", "1g", "--memory-swap", "1g", "--cpus", "1", "--pids-limit", "32",
         "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--log-driver", "none", "--ulimit", "core=0:0"]


def docker(*args, check=True, data=None):
    return subprocess.run(["docker", *args], input=data, capture_output=True, text=True, check=check, timeout=140)


def shell(script, check=True):
    return docker("exec", name, "sh", "-c", script, check=check)


def start(stub=False):
    extra = ["--tmpfs", "/opt/yt-dlp:rw,exec,nosuid,nodev,size=1048576,mode=1777"] if stub else []
    docker("run", "-d", "--name", name, *flags, *extra, "--entrypoint", "sleep", image, "600")
    assert shell("cat /sys/fs/cgroup/memory.swap.max").stdout.strip() == "0"


def remove():
    docker("rm", "-f", name, check=False)


def write(path, text):
    docker("exec", "-i", name, "sh", "-c", f"cat > {path}", data=text)


def measure(command):
    before = int(shell("sed -n 's/usage_usec //p' /sys/fs/cgroup/cpu.stat").stdout)
    started = time.monotonic()
    result = shell(command, check=False)
    wall = time.monotonic() - started
    after = int(shell("sed -n 's/usage_usec //p' /sys/fs/cgroup/cpu.stat").stdout)
    peak = int(shell("cat /sys/fs/cgroup/memory.peak").stdout)
    assert shell("cat /sys/fs/cgroup/memory.swap.current").stdout.strip() == "0"
    return result, {"wallSeconds": round(wall, 3), "cpuSeconds": round((after-before)/1e6, 3), "containerPeakBytes": peak}


try:
    startup = {}
    for label, command in [("Rust-byte-relay", f"{worker} --limit-input < /dev/null"),
                           ("yt-dlp-version", f"{downloader} --version"), ("Deno-eval", "deno eval '0'")]:
        samples = []
        for _ in range(3):
            start()
            result, stats = measure(command)
            assert result.returncode == 0, result.stderr
            samples.append(stats)
            remove()
        startup[label] = {key: statistics.median(s[key] for s in samples) for key in samples[0]}

    # 실제 yt-dlp generic extractor의 로컬 HTTP→stdout. YouTube/EJS 성공 검증이 아니다.
    start()
    seconds, rate = 240, 24000
    frames = seconds * rate
    header = struct.pack("<4sI4s4sIHHIIHH4sI", b"RIFF", 36+frames*2, b"WAVE", b"fmt ",
                         16, 1, 1, rate, rate*2, 2, 16, b"data", frames*2)
    args = ["-nostdin", "-hide_banner", "-loglevel", "error", "-threads", "1", "-filter_threads", "1",
            "-f", "lavfi", "-i", f"sine=frequency=440:sample_rate={rate}:duration={seconds}", "-threads", "1", "-f", "s16le", "pipe:1"]
    server = ('Deno.serve({hostname:"127.0.0.1",port:8765,onListen(){}},()=>{'
              f'const p=new Deno.Command("/usr/bin/ffmpeg",{{args:{json.dumps(args)},stdout:"piped",stderr:"null"}}).spawn();'
              'const t=new TransformStream(); (async()=>{const w=t.writable.getWriter();'
              f'await w.write(new Uint8Array({list(header)})); w.releaseLock(); await p.stdout.pipeTo(t.writable);}})()'
              '.catch(()=>{try{p.kill("SIGKILL")}catch{}});'
              f'return new Response(t.readable,{{headers:{{"Content-Type":"audio/wav","Content-Length":"{44+frames*2}"}}}});}});')
    write("/tmp/server.js", server)
    shell("deno run --allow-net=127.0.0.1:8765 --allow-run=/usr/bin/ffmpeg /tmp/server.js >/dev/null 2>/tmp/server-error & echo $! >/tmp/server-pid")
    time.sleep(0.3)
    shell('kill -0 "$(cat /tmp/server-pid)" || { cat /tmp/server-error >&2; exit 1; }')
    command = (f"{downloader} --ignore-config --no-plugin-dirs --no-remote-components --no-cache-dir "
               "--quiet --no-warnings --no-progress --no-part --no-playlist --retries 0 -o - -- "
               "http://127.0.0.1:8765/audio.wav > /tmp/count-pipe")
    # 실제 CLI→FIFO→Rust→ffmpeg/BBC. 음원 파일 없이 각 종료 상태와 최종 JSON을 확인한다.
    result, stream = measure(f"mkfifo /tmp/count-pipe; {worker} < /tmp/count-pipe > /tmp/result.json 2>/tmp/error & count=$!; "
                             + command + '; status=$?; wait "$count"; analyzed=$?; cat /tmp/result.json; '
                             'cat /tmp/error >&2; test "$status" = 0 && test "$analyzed" = 0')
    assert result.returncode == 0 and json.loads(result.stdout)["durationMs"] == 240000, result.stderr + shell("cat /tmp/server-error").stdout
    remove()

    start(stub=True)
    stub = ('#!/bin/sh\nset -eu\n'
            'test "$*" = "' + ' '.join(["--ignore-config --no-plugin-dirs --no-remote-components --no-playlist",
             "--quiet --no-warnings --no-progress --no-cache-dir --no-part --no-wait-for-video --socket-timeout 10",
             "--retries 0 --fragment-retries 0 --js-runtimes deno:/usr/local/bin/deno --use-extractors youtube",
             "--match-filters !is_live & !was_live & duration <= 3600 -f bestaudio[protocol=https] --downloader native -o - --",
             "https://www.youtube.com/watch?v=local000001"]) + '"\n'
            'test -z "${PROBE_SECRET:-}"\n'
            'if test -f /tmp/block; then sleep 100 & echo $! >/tmp/descendant; wait; fi\n'
            'ffmpeg -nostdin -hide_banner -loglevel error -threads 1 -filter_threads 1 -f lavfi '
            '-i "aevalsrc=if(between(t\\,0.24\\,0.245)+between(t\\,1.62\\,1.625)+between(t\\,2.693\\,2.698)\\,0.5\\,0):s=48000:d=3.013" '
            '-threads 1 -c:a flac -f flac pipe:1\n'
            'test ! -f /tmp/fail\n')
    write(downloader, stub)
    shell(f"chmod 755 {downloader}")
    approved = f"WAVEFORM_YOUTUBE_APPROVED_VIDEO_IDS=local000001 PROBE_SECRET=must-not-inherit {worker} --youtube local000001"
    for command in [f"{worker} --youtube local000001", f"{worker} --youtube https://youtu.be/local000001", approved]:
        result = shell(command, check=False)
        if command == approved:
            assert result.returncode == 0, result.stderr
            data = json.loads(result.stdout)
            assert data["durationMs"] == 3013
            offsets = []
            for anchor in [0.24, 1.62, 2.693]:
                expected = int(anchor/0.02)
                actual = max(range(expected-1, expected+2), key=lambda i: data["peaks"]["data"][i*2+1])
                assert data["peaks"]["data"][actual*2+1] > 20
                offsets.append(round(actual*20-anchor*1000, 3))
            assert max(abs(v) for v in offsets) <= 20 and max(offsets)-min(offsets) <= 20
        else:
            assert result.returncode != 0 and not result.stdout
    shell("touch /tmp/fail")
    result = shell(approved, check=False)
    assert result.returncode != 0 and not result.stdout  # 정상 음원을 출력했어도 downloader 실패면 거절한다.
    shell("rm /tmp/fail; touch /tmp/block")
    result = shell(approved + ' >/tmp/result 2>/tmp/error & pid=$!; sleep 0.5; kill -TERM "$pid"; wait "$pid"', check=False)
    assert result.returncode != 0
    shell('test ! -s /tmp/result; test ! -e /proc/$(cat /tmp/descendant); '
          'rm /tmp/block /tmp/descendant /tmp/result /tmp/error; test -z "$(ls -A /tmp)"')
    for size in [128*1024*1024, 128*1024*1024+1]:
        result = shell(f"head -c {size} /dev/zero | {worker} --limit-input >/dev/null", check=False)
        assert (result.returncode == 0) == (size == 128*1024*1024)
    print(json.dumps({"startupThreeRunMedians": startup, "localHttp240sIncludingFixtureServer": stream,
                      "syntheticFlacAnchorOffsetsMs": offsets, "stubFailureAndDescendantCleanup": True,
                      "externalMediaRequests": 0, "nativeRustYoutubeComparison": False}))
finally:
    remove()
