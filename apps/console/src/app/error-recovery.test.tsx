import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ErrorBoundaryHandler } from "next/dist/client/components/error-boundary";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminError from "./(admin)/admin/error";
import { AppProviders } from "./app-providers";

vi.mock("@/shared/api/capture-client-error", () => ({ captureClientErrorOnce: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("관리자 오류 복구", () => {
  it.each(["query", "render"] as const)(
    "%s 실패 뒤 Query와 Next 경계를 함께 복구한다",
    async (kind) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const load = vi
        .fn()
        .mockRejectedValueOnce(new Error("일시적 조회 실패"))
        .mockResolvedValue("복구 완료");
      let serverFailed = true;
      const refresh = vi.fn(() => {
        serverFailed = false;
      });
      function Page() {
        const { data } = useSuspenseQuery({
          queryKey: ["recovery", kind],
          queryFn: load,
          retry: false,
        });
        return <p>{data}</p>;
      }
      function FailedRender() {
        if (serverFailed) throw new Error("일시적 렌더 실패");
        return <p>복구 완료</p>;
      }
      render(
        <AppRouterContext
          value={{
            refresh,
            back: vi.fn(),
            forward: vi.fn(),
            push: vi.fn(),
            replace: vi.fn(),
            prefetch: vi.fn(),
            bfcacheId: "recovery",
          }}
        >
          <AppProviders>
            <ErrorBoundaryHandler
              pathname="/admin/albums"
              errorComponent={({ error, retry }) => {
                if (!(error instanceof Error)) throw error;
                return <AdminError error={error} retry={retry} />;
              }}
            >
              <Suspense fallback={<p>조회 중</p>}>
                {kind === "query" ? <Page /> : <FailedRender />}
              </Suspense>
            </ErrorBoundaryHandler>
          </AppProviders>
        </AppRouterContext>,
      );
      fireEvent.click(await screen.findByRole("button", { name: "다시 시도" }));
      await screen.findByText("복구 완료");
      expect(refresh).toHaveBeenCalledOnce();
      expect(load).toHaveBeenCalledTimes(kind === "query" ? 2 : 0);
    },
  );
});
