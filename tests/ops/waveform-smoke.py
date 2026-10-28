"""로컬 전용 검증: 고정한 이미지 digest에서 합성 fixture와 강제 종료를 실행한다."""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import uuid

image = sys.argv[1]
assert re.fullmatch(r"sha256:[a-f0-9]{64}", image), "use the loaded OCI manifest digest"
name = f"p08-waveform-{uuid.uuid4()}"
flags = ["--rm", "--name", name, "--read-only", "--network", "none",
         "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=67108864",
         "--memory", "256m", "--memory-swap", "256m", "--cpus", "1", "--pids-limit", "32",
         "--ulimit", "core=0:0", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
         "--log-driver", "none"]


def docker(*args):
    return subprocess.run(["docker", *args], capture_output=True, text=True, timeout=15)


def inspect():
    result = docker("inspect", name)
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)[0]
    host = data["HostConfig"]
    assert host["ReadonlyRootfs"] and host["NetworkMode"] == "none"
    assert host["Memory"] == host["MemorySwap"] == 256 * 1024 * 1024
    assert host["PidsLimit"] == 32 and host["NanoCpus"] == 1_000_000_000
    assert host["LogConfig"]["Type"] == "none" and data["Mounts"] == []
    assert data["Config"]["User"] == "65532:65532"
    return data["State"]["Running"]


try:
    fixture = (Path(__file__).resolve().parents[2] / "ops/waveform/smoke.py").read_text()
    process = subprocess.Popen(["docker", "run", *flags, "--entrypoint", "python3", image,
                                "-c", fixture], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(1)
    assert inspect()
    output, error = process.communicate(timeout=180)
    assert process.returncode == 0, error.decode()
    assert not error
    report = json.loads(output)
    assert docker("inspect", name).returncode != 0
    process = subprocess.Popen(["docker", "run", "-i", *flags, image], stdin=subprocess.PIPE,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(1)
    assert inspect()
    assert docker("kill", "--signal", "KILL", name).returncode == 0
    output, error = process.communicate(timeout=10)
    assert process.returncode == 137 and not output, error
    assert docker("inspect", name).returncode != 0
    report.update({"image": image, "forcedKillRemoved": True, "persistentMounts": 0})
    print(json.dumps(report))
finally:
    docker("rm", "-f", name)
