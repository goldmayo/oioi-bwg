"""실제 도구를 사용하는 합성 WAV 수용 검사. 반드시 격리 container 안에서 실행한다."""
import io
import json
import os
import resource
import signal
import struct
import subprocess
import time
import wave


def check_clean():
    assert not os.listdir("/tmp"), "temporary files remain"
    for name in os.listdir("/proc"):
        if name.isdigit():
            try:
                with open(f"/proc/{name}/comm") as stream:
                    assert stream.read().strip() not in ("ffmpeg", "audiowaveform")
            except FileNotFoundError:
                pass


def fixture(duration):
    rate = 48000
    frames = round(duration * rate)
    anchors = [0.24, duration / 2 + 0.12, duration - 0.32]
    header = io.BytesIO()
    with wave.open(header, "wb") as stream:
        stream.setnchannels(2)
        stream.setsampwidth(2)
        stream.setframerate(rate)
        stream.setnframes(frames)
        stream.writeframesraw(b"")
    # wave의 close()가 빈 data 길이로 되돌리므로 알려진 PCM 크기를 명시한다.
    data = bytearray(header.getvalue())
    struct.pack_into("<I", data, 4, 36 + frames * 4)
    struct.pack_into("<I", data, 40, frames * 4)
    yield bytes(data)
    for start in range(0, frames, rate):
        chunk = bytearray(min(rate, frames - start) * 4)
        for anchor in anchors:
            position = round(anchor * rate) - start
            if 0 <= position < len(chunk) // 4:
                # 5ms 사각 pulse: 초반/중간/후반의 위치와 resampling drift 관측.
                pulse = struct.pack("<hh", 16000, 16000) * min(240, len(chunk) // 4 - position)
                chunk[position * 4:position * 4 + len(pulse)] = pulse
        yield chunk


def run(duration, invalid=False):
    before = resource.getrusage(resource.RUSAGE_CHILDREN)
    started = time.monotonic()
    process = subprocess.Popen(["python3", "/opt/analyze.py"], stdin=subprocess.PIPE,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        for chunk in ([b"invalid WAV"] if invalid else fixture(duration)):
            process.stdin.write(chunk)
        process.stdin.close()
    except BrokenPipeError:
        pass
    process.stdin = None
    output, error = process.communicate(timeout=130)
    check_clean()
    if invalid or duration > 3600:
        assert process.returncode != 0 and not output
        assert error == b"WAVEFORM_ANALYSIS_FAILED\n"
        return {"case": "invalid" if invalid else "over-limit", "rejected": True}
    assert process.returncode == 0 and not error, error
    result = json.loads(output)
    assert result["durationMs"] == round(duration * 1000)
    assert result["bucketSizeMs"] == 20
    peaks = result["peaks"]
    offsets = []
    for anchor in [0.24, duration / 2 + 0.12, duration - 0.32]:
        expected = int(anchor / 0.02)
        nearby = range(max(0, expected - 2), min(peaks["length"], expected + 3))
        actual = max(nearby, key=lambda index: peaks["data"][index * 2 + 1])
        assert peaks["data"][actual * 2 + 1] > 20
        offsets.append(round(actual * 20 - anchor * 1000, 3))
    assert max(abs(value) for value in offsets) <= 20
    assert max(offsets) - min(offsets) <= 20
    after = resource.getrusage(resource.RUSAGE_CHILDREN)
    return {"seconds": duration, "elapsedSeconds": round(time.monotonic() - started, 3),
            "cpuSeconds": round(after.ru_utime + after.ru_stime - before.ru_utime - before.ru_stime, 3),
            "maxChildRssKiB": after.ru_maxrss, "jsonBytes": len(output), "anchorOffsetsMs": offsets}


def interrupt():
    process = subprocess.Popen(["python3", "/opt/analyze.py"], stdin=subprocess.PIPE,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(0.3)
    process.send_signal(signal.SIGTERM)
    output, error = process.communicate(timeout=5)
    assert process.returncode != 0 and not output
    assert error == b"WAVEFORM_ANALYSIS_FAILED\n"
    check_clean()
    return {"case": "terminated-blocked-input", "rejected": True}


def timeout():
    process = subprocess.Popen(["python3", "/opt/analyze.py"], stdin=subprocess.PIPE,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    started = time.monotonic()
    process.wait(timeout=125)  # stdin을 열어 둔 채 실제 120초 alarm을 기다린다.
    output, error = process.communicate(timeout=5)
    assert process.returncode != 0 and not output
    assert error == b"WAVEFORM_ANALYSIS_FAILED\n"
    elapsed = time.monotonic() - started
    assert 119 <= elapsed <= 125
    check_clean()
    return {"case": "blocked-input-timeout", "elapsedSeconds": round(elapsed, 3)}


if __name__ == "__main__":
    assert os.uname().machine == "aarch64"
    with open("/sys/fs/cgroup/memory.swap.max") as stream:
        assert stream.read().strip() == "0", "swap must be disabled for this cgroup"
    assert resource.getrlimit(resource.RLIMIT_CORE) == (0, 0)
    results = [run(3.013), run(240), run(3600), run(0, invalid=True), run(3601), interrupt(), timeout()]
    with open("/sys/fs/cgroup/memory.peak") as stream:
        memory_peak = int(stream.read())
    with open("/sys/fs/cgroup/memory.swap.current") as stream:
        assert int(stream.read()) == 0
    print(json.dumps({"cases": results, "memoryPeakBytes": memory_peak, "tmpfsFilesAfter": 0}))
