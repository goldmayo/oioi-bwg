import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError, ClientContractError, ClientTransportError } from "../http-errors";

import { createQueryClient, getGlobalMutationErrorMessage } from "./query-client";

describe("global mutation error UX", () => {
  it("uses safe messages for typed client errors", () => {
    expect(
      getGlobalMutationErrorMessage(
        new ApiError(403, { code: "FORBIDDEN", message: "접근 권한이 없습니다." }),
      ),
    ).toBe("접근 권한이 없습니다.");
    expect(
      getGlobalMutationErrorMessage(
        new ClientTransportError("NETWORK_ERROR", "네트워크 연결을 확인해 주세요."),
      ),
    ).toBe("네트워크 연결을 확인해 주세요.");
  });

  it("supports a local-handler escape hatch and an explicit message", () => {
    expect(getGlobalMutationErrorMessage(new Error("secret"), { skipGlobalError: true })).toBe(
      undefined,
    );
    expect(getGlobalMutationErrorMessage(new Error("secret"), { errorMessage: "삭제 실패" })).toBe(
      "삭제 실패",
    );
  });

  it("notifies once through MutationCache", async () => {
    const onMutationError = vi.fn();
    const client = createQueryClient({ onMutationError });
    const mutation = client.getMutationCache().build(client, {
      mutationFn: () => Promise.reject(new Error("internal detail")),
    });

    await expect(mutation.execute(undefined)).rejects.toThrow("internal detail");
    expect(onMutationError).toHaveBeenCalledOnce();
    expect(onMutationError).toHaveBeenCalledWith(
      "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });

  it("does not expose contract parse details to users", () => {
    const result = z.string().safeParse(1);
    if (result.success) throw new Error("test setup failed");
    const parseError = new ClientContractError(result.error);

    expect(getGlobalMutationErrorMessage(parseError)).toBe(
      "서버 응답을 확인하는 중 오류가 발생했습니다.",
    );
  });
});
