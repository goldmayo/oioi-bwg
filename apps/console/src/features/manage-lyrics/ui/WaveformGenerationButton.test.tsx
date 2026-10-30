import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { waveformQueryKeys } from "@/entities/waveform";

import { ApiError } from "@/shared/api/http-errors";

import { WaveformGenerationButton } from "./WaveformGenerationButton";

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/shared/api/http-client", () => ({ http: { post: mocks.post } }));
const songId = "019a0170-0000-7000-8000-000000000001";
const jobId = "019a0170-0000-7000-8000-000000000002";
afterEach(() => vi.resetAllMocks());

function setup(props: Partial<Parameters<typeof WaveformGenerationButton>[0]> = {}) {
  const onError = vi.fn();
  const client = new QueryClient();
  client.setQueryData(waveformQueryKeys.song("admin", songId), null);
  client.setQueryData(waveformQueryKeys.song("other", songId), null);
  render(
    <QueryClientProvider client={client}>
      <WaveformGenerationButton
        songId={songId}
        accountId="admin"
        disabled={false}
        videoChanged={false}
        onError={onError}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onError, client };
}

it("저장된 곡 식별자만 보내고 접수 뒤 결과 링크를 표시한다", async () => {
  let finish!: (value: unknown) => void;
  mocks.post.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { client } = setup();
  fireEvent.click(screen.getByRole("button", { name: "파형 생성" }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
  expect(mocks.post).toHaveBeenCalledWith("/api/admin/waveform-jobs", { json: { songId } });
  expect(
    (screen.getByRole("button", { name: "파형 생성 요청 중…" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  await act(async () => finish({ jobId }));
  expect((await screen.findByRole("link", { name: "생성 결과 확인" })).getAttribute("href")).toBe(
    `/admin/waveform-jobs/${jobId}`,
  );
  expect(client.getQueryState(waveformQueryKeys.song("admin", songId))?.isInvalidated).toBe(true);
  expect(client.getQueryState(waveformQueryKeys.song("other", songId))?.isInvalidated).toBe(false);
});

it.each([{ videoChanged: true }, { disabled: true }])(
  "미저장 영상·인가 차단 중에는 요청하지 않는다: %j",
  (props) => {
    setup(props);
    const button = screen.getByRole("button", { name: "파형 생성" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(mocks.post).not.toHaveBeenCalled();
  },
);

it("인증 오류를 상위 복구로 전달하고 요청을 자동 재시도하지 않는다", async () => {
  const error = new ApiError(401, { code: "UNAUTHENTICATED", message: "다시 로그인해주세요." });
  mocks.post.mockRejectedValue(error);
  const { onError } = setup();
  fireEvent.click(screen.getByRole("button", { name: "파형 생성" }));
  expect((await screen.findByRole("alert")).textContent).toBe(error.message);
  expect(onError).toHaveBeenCalledWith(error, expect.anything(), undefined, expect.anything());
  expect(mocks.post).toHaveBeenCalledOnce();
});

it("잘못된 접수 응답과 내부 오류 원문을 사용자에게 노출하지 않는다", async () => {
  mocks.post.mockResolvedValue({ jobId: "PRIVATE_INVALID_ID" });
  setup();
  fireEvent.click(screen.getByRole("button", { name: "파형 생성" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "요청 결과를 확인하지 못했습니다.",
  );
  expect(screen.queryByRole("link")).toBeNull();
  expect(document.body.textContent).not.toContain("PRIVATE_INVALID_ID");
});
