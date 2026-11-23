import { vi } from "vitest";

// 각 route suite가 context·거부를 직접 지정한다. 인증 성공을 기본값으로 만들지 않는다.
export const getRequestContext = vi.fn<() => Promise<unknown>>(async () => {
  throw new Error("테스트에서 인증 context를 명시해야 합니다.");
});
export const getRequestAuthorization = async () => ({
  context: await getRequestContext(),
  decision: "unknown",
  rejectionLogged: false,
});
export const logger = { error: vi.fn() };
