import { execFile } from "node:child_process";
import { lstat, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

import { waveformDataSchema } from "@oioi-bwg/contracts/waveform";

const image = "sha256:60276ecfe9f487ffb50c18cee030e680833c394113b2cd5e3e3e553f29d82039";
const name = "oioi-waveform-local";
const label = "com.oioi.waveform.local-run";
const execute = promisify(execFile);
export function parseWaveformArguments(args: string[]) {
  if (args.length !== 4 || args[0] !== "--video" || args[2] !== "--output" || !args[3])
    throw new Error("Usage: pnpm waveform:generate --video VIDEO_ID_OR_URL --output FILE.json");
  const match = /^(?:https:\/\/)?www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})$/.exec(args[1]!);
  const videoId = match?.[1] ?? args[1]!;
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error("Invalid video ID");
  return { videoId, output: args[3] };
}
export type DockerCall = (
  args: string[],
  options?: { signal?: AbortSignal; timeout?: number },
) => Promise<string>;
const docker: DockerCall = async (args, options) =>
  (
    await execute("docker", ["--host", "unix:///var/run/docker.sock", ...args], {
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 4 * 1024 * 1024,
      ...options,
    })
  ).stdout;

/** 로컬 Docker만 호출한다. 앱/클라우드 credential과 음원 파일을 전달·저장하지 않는다. */
export async function generateLocalWaveform(
  input: ReturnType<typeof parseWaveformArguments>,
  call: DockerCall = docker,
) {
  try {
    await lstat(input.output);
    throw new Error("LOCAL_WAVEFORM_OUTPUT_EXISTS");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const owner = randomUUID();
  const abort = new AbortController();
  const stop = () => abort.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  let output: string;
  let created = false;
  try {
    try {
      await call([
        "create",
        "--pull=never",
        "--platform",
        "linux/arm64",
        "--name",
        name,
        "--label",
        `${label}=${owner}`,
        "--network",
        "bridge",
        "--dns",
        "1.1.1.1",
        "--dns",
        "1.0.0.1",
        "--read-only",
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,nodev,size=67108864",
        "--memory",
        "1g",
        "--memory-swap",
        "1g",
        "--cpus",
        "1",
        "--pids-limit",
        "32",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--log-driver",
        "none",
        "--ulimit",
        "core=0:0",
        "--user",
        "65532:65532",
        "--restart=no",
        "--env",
        `WAVEFORM_YOUTUBE_APPROVED_VIDEO_IDS=${input.videoId}`,
        "--entrypoint",
        "/usr/local/bin/oioi-waveform",
        image,
        "--youtube",
        input.videoId,
      ]);
      created = true;
      const raw = await call(["start", "--attach", name], {
        signal: abort.signal,
        timeout: 130_000,
      });
      const result = waveformDataSchema.parse({
        ...JSON.parse(raw),
        source: { type: "youtube", id: input.videoId },
        generationVersion: 1,
      });
      output = JSON.stringify(result) + "\n";
    } finally {
      // create 응답 유실에도 자기 label만 회수한다. 이름 충돌로 실행하지 못한 다른 작업은 보존한다.
      let actual: string | undefined;
      try {
        actual = (
          await call(["inspect", "--format", `{{index .Config.Labels "${label}"}}`, name])
        ).trim();
      } catch (error) {
        const failure = error as { code?: unknown; stderr?: string };
        if (failure.code !== 1 || !failure.stderr?.includes(`No such object: ${name}`))
          throw new Error("LOCAL_WAVEFORM_CLEANUP_UNCONFIRMED");
      }
      if (actual === owner) await call(["rm", "--force", name]);
      else if (created && actual !== undefined)
        throw new Error("LOCAL_WAVEFORM_CLEANUP_UNCONFIRMED");
    }
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
  abort.signal.throwIfAborted();
  await mkdir(dirname(input.output), { recursive: true, mode: 0o700 });
  // wx는 같은 경로의 기존 JSON·symlink를 덮어쓰지 않는다. 정리 확인 전에는 쓰지 않는다.
  await writeFile(input.output, output, { flag: "wx", mode: 0o600 });
  return { output: input.output, videoId: input.videoId, bytes: Buffer.byteLength(output) };
}
