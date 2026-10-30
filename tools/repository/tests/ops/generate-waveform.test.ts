import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import {
  generateLocalWaveform,
  parseWaveformArguments,
  type DockerCall,
} from "../../src/operators/generate-waveform";
const raw = {
  durationMs: 20,
  bucketSizeMs: 20,
  peaks: {
    version: 1,
    sample_rate: 24000,
    samples_per_pixel: 480,
    bits: 8,
    length: 1,
    data: [-2, 2],
  },
};
const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "p08-local-json-"));
  dirs.push(dir);
  const input = { videoId: "abcdefghijk", output: join(dir, "waveform.json") };
  let owner = "";
  const call = vi.fn<DockerCall>(async (args) => {
    if (args[0] === "create") owner = args[args.indexOf("--label") + 1]!.split("=")[1]!;
    return args[0] === "start" ? JSON.stringify(raw) : args[0] === "inspect" ? owner : "";
  });
  return { input, call };
}
it("단일 canonical videoId/URL만 받으며 playlist와 실행 설정 입력을 거절한다", () => {
  for (const video of [
    "abcdefghijk",
    "www.youtube.com/watch?v=abcdefghijk",
    "https://www.youtube.com/watch?v=abcdefghijk",
  ])
    expect(parseWaveformArguments(["--video", video, "--output", "out.json"]).videoId).toBe(
      "abcdefghijk",
    );
  for (const video of [
    "https://other.test/abcdefghijk",
    "https://www.youtube.com/watch?v=abcdefghijk&list=x",
    "--privileged",
  ])
    expect(() => parseWaveformArguments(["--video", video, "--output", "out.json"])).toThrow();
});
it("고정 ARM64 분석기와 자원·비영속 경계를 유지하고 정리 후 기존 DTO를 0600으로 내보낸다", async () => {
  const { input, call } = await setup();
  await generateLocalWaveform(input, call);
  const args = call.mock.calls[0]![0];
  expect(args).toEqual(
    expect.arrayContaining([
      "--pull=never",
      "linux/arm64",
      "--read-only",
      "--log-driver",
      "none",
      "--memory",
      "1g",
      "--memory-swap",
      "--cpus",
      "1",
      "--pids-limit",
      "32",
    ]),
  );
  expect(args.filter((a) => a === "--env")).toHaveLength(1);
  expect(args).not.toContain("--volume");
  expect(call.mock.calls.at(-1)![0]).toEqual(["rm", "--force", "oioi-waveform-local"]);
  expect(JSON.parse(await readFile(input.output, "utf8"))).toEqual({
    ...raw,
    source: { type: "youtube", id: input.videoId },
    generationVersion: 1,
  });
  expect((await stat(input.output)).mode & 0o777).toBe(0o600);
});
it.each(["analysis", "invalid-json", "cleanup"])(
  "%s 실패에는 새 JSON을 쓰지 않고 자기 컨테이너를 정리한다",
  async (failure) => {
    const { input, call } = await setup();
    const normal = call.getMockImplementation()!;
    call.mockImplementation(async (args, options) => {
      if (args[0] === "start" && failure === "analysis") throw new Error("exit 1");
      if (args[0] === "start" && failure === "invalid-json") return "{}";
      if (args[0] === "rm" && failure === "cleanup") throw new Error("daemon unavailable");
      return normal(args, options);
    });
    await expect(generateLocalWaveform(input, call)).rejects.toThrow();
    await expect(stat(input.output)).rejects.toMatchObject({ code: "ENOENT" });
    expect(call.mock.calls.at(-1)![0][0]).toBe("rm");
  },
);
it("이름 충돌은 다른 분석기를 삭제하지 않으며 기존 JSON은 덮어쓰지 않는다", async () => {
  const { input, call } = await setup();
  call.mockImplementation(async (args) => {
    if (args[0] === "create") throw new Error("name conflict");
    return "another-owner";
  });
  await expect(generateLocalWaveform(input, call)).rejects.toThrow("name conflict");
  expect(call.mock.calls.some(([args]) => args[0] === "rm")).toBe(false);
  const next = await setup();
  await writeFile(next.input.output, "previous");
  await expect(generateLocalWaveform(next.input, next.call)).rejects.toThrow(
    "LOCAL_WAVEFORM_OUTPUT_EXISTS",
  );
  expect(await readFile(next.input.output, "utf8")).toBe("previous");
  expect(next.call).not.toHaveBeenCalled();
});
