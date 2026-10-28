"""허용된 WAV stdin만 분석한다. source/Job/네트워크/영속 저장은 호출자 소유다."""
import json
import math
import resource
import signal
import subprocess
import sys
import tempfile

RATE = 24000
BUCKET = 480
MAX_SECONDS = 3600
MAX_JSON = 4 * 1024 * 1024
TIMEOUT_SECONDS = 120


def interrupted(*_):
    raise RuntimeError("INTERRUPTED")


def analyze():
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_JSON, MAX_JSON))
    for sig in (signal.SIGALRM, signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, interrupted)
    signal.alarm(TIMEOUT_SECONDS)
    children = []
    try:
        # JSON만 tmpfs에 쓴다. 음원/PCM과 도구 stderr는 파일·로그에 남기지 않는다.
        with tempfile.TemporaryDirectory(dir="/tmp") as directory:
            output = f"{directory}/peaks.json"
            decoder = subprocess.Popen([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-xerror",
                "-nostdin", "-threads", "1", "-protocol_whitelist", "pipe",
                "-f", "wav", "-i", "pipe:0", "-map", "0:a:0", "-vn",
                "-ac", "1", "-ar", str(RATE), "-threads", "1", "-f", "s16le", "pipe:1",
            ], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            children.append(decoder)
            peaks = subprocess.Popen([
                "audiowaveform", "--input-format", "raw", "--raw-format", "s16le",
                "--raw-samplerate", str(RATE), "--raw-channels", "1",
                "--output-format", "json", "-o", output, "-z", str(BUCKET), "-b", "8",
            ], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            children.append(peaks)
            count = 0
            while chunk := decoder.stdout.read(65536):
                count += len(chunk)
                if count > RATE * 2 * MAX_SECONDS:
                    raise RuntimeError("INPUT_LIMIT")
                peaks.stdin.write(chunk)
            peaks.stdin.close()
            duration_ms = round(count / 2 * 1000 / RATE)
            if decoder.wait() != 0 or peaks.wait() != 0 or duration_ms < 1 or count % 2:
                raise RuntimeError("PROCESSING_FAILED")
            with open(output, "rb") as stream:
                encoded = stream.read(MAX_JSON + 1)
            if len(encoded) > MAX_JSON:
                raise RuntimeError("OUTPUT_LIMIT")
            data = json.loads(encoded)
            length = math.ceil(count / 2 / BUCKET)
            if (data["version"] not in (1, 2) or data.get("channels", 1) != 1
                    or (data["version"] == 2 and data.get("channels") != 1)
                    or data["sample_rate"] != RATE or data["samples_per_pixel"] != BUCKET
                    or data["bits"] != 8 or data["length"] != length
                    or len(data["data"]) != length * 2):
                raise RuntimeError("INVALID_OUTPUT")
            for low, high in zip(data["data"][::2], data["data"][1::2]):
                if not (type(low) is int and type(high) is int and -128 <= low <= high <= 127):
                    raise RuntimeError("INVALID_OUTPUT")
            result = json.dumps({
                "durationMs": duration_ms,
                "bucketSizeMs": BUCKET * 1000 / RATE, "peaks": data,
            }, separators=(",", ":"))
            if len(result.encode()) > MAX_JSON:
                raise RuntimeError("OUTPUT_LIMIT")
            return result
    finally:
        signal.alarm(0)
        for child in children:
            if child.poll() is None:
                child.kill()
            child.wait()


if __name__ == "__main__":
    try:
        if len(sys.argv) != 1:
            raise RuntimeError("ARGUMENTS_REJECTED")
        print(analyze())
    except Exception:
        print("WAVEFORM_ANALYSIS_FAILED", file=sys.stderr)
        sys.exit(1)
