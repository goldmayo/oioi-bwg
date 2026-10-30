import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { waveformQueryKeys } from "@/entities/waveform";

import { ApiError } from "@/shared/api/http-errors";

import { WaveformImportButton } from "./WaveformImportButton";

const mocks = vi.hoisted(() => ({ put: vi.fn() }));
vi.mock("@/shared/api/http-client", () => ({ http: { put: mocks.put } }));
const id = "019a0170-0000-7000-8000-000000000001";
const waveform = {
  durationMs: 20,
  bucketSizeMs: 20,
  generationVersion: 1,
  source: { type: "youtube", id: "abcdefghijk" },
  peaks: {
    version: 1,
    sample_rate: 24000,
    samples_per_pixel: 480,
    bits: 8,
    length: 1,
    data: [-2, 2],
  },
};
const job = {
  id,
  songId: id,
  videoId: "abcdefghijk",
  status: "SUCCEEDED",
  errorCode: null,
  createdAt: "2026-10-31T00:00:00Z",
  finishedAt: "2026-10-31T00:00:00Z",
  editorHref: "/admin/edit/test",
};
afterEach(() => vi.resetAllMocks());
function setup(props: Partial<Parameters<typeof WaveformImportButton>[0]> = {}) {
  const onError = vi.fn();
  const client = new QueryClient();
  client.setQueryData(waveformQueryKeys.song("admin", id), null);
  client.setQueryData(waveformQueryKeys.song("other", id), null);
  render(
    <QueryClientProvider client={client}>
      <WaveformImportButton
        accountId="admin"
        songId={id}
        videoId="abcdefghijk"
        disabled={false}
        videoChanged={false}
        onError={onError}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { client, onError };
}
function choose(value = JSON.stringify(waveform)) {
  const file = new File([value], "waveform.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: () => Promise.resolve(value) });
  fireEvent.change(screen.getByLabelText("파형 JSON 파일"), { target: { files: [file] } });
}
it("파일 등록 후 계정의 파형을 다시 조회하며 다른 계정 cache는 보존한다", async () => {
  let finish!: (value: unknown) => void;
  mocks.put.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { client } = setup();
  choose();
  await waitFor(() => expect(mocks.put).toHaveBeenCalledOnce());
  expect(mocks.put).toHaveBeenCalledWith(`/api/admin/songs/${id}/waveform`, { json: waveform });
  expect(
    (screen.getByRole("button", { name: "파형 JSON 등록 중…" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  await act(async () => finish(job));
  expect((await screen.findByRole("link", { name: "등록 결과 확인" })).getAttribute("href")).toBe(
    `/admin/waveform-jobs/${id}`,
  );
  expect(client.getQueryState(waveformQueryKeys.song("admin", id))?.isInvalidated).toBe(true);
  expect(client.getQueryState(waveformQueryKeys.song("other", id))?.isInvalidated).toBe(false);
});
it.each([{ videoChanged: true }, { disabled: true }])(
  "미저장 영상·저장/인가 차단 중에는 등록하지 않는다: %j",
  (props) => {
    setup(props);
    choose();
    expect(
      (screen.getByRole("button", { name: "파형 JSON 등록" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(mocks.put).not.toHaveBeenCalled();
  },
);
it.each([
  "broken",
  "{}",
  JSON.stringify({ ...waveform, source: { type: "youtube", id: "lmnopqrstuv" } }),
  " ".repeat(4 * 1024 * 1024 + 1),
])("잘못된 파일은 HTTP 전송 전에 거절한다 #%#", async (raw) => {
  setup();
  choose(raw);
  expect((await screen.findByRole("alert")).textContent).toBeTruthy();
  expect(mocks.put).not.toHaveBeenCalled();
});
it("인증 오류는 기존 복구로 전달하며 같은 파일을 다시 선택할 수 있다", async () => {
  const error = new ApiError(401, { code: "UNAUTHENTICATED", message: "다시 로그인해 주세요." });
  mocks.put.mockRejectedValueOnce(error).mockResolvedValueOnce(job);
  const { onError } = setup();
  choose();
  expect((await screen.findByRole("alert")).textContent).toBe(error.message);
  expect(onError).toHaveBeenCalled();
  expect(mocks.put).toHaveBeenCalledOnce();
  choose();
  expect(await screen.findByRole("link", { name: "등록 결과 확인" })).toBeTruthy();
  expect(mocks.put).toHaveBeenCalledTimes(2);
});
