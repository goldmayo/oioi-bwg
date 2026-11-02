import { AppError } from "@oioi-bwg/server/errors/app-error";
import { beforeEach, expect, it, vi } from "vitest";

const remove = vi.hoisted(() => vi.fn());
vi.mock("@oioi-bwg/server/services/cheer-guide-service", () => ({ deleteEmptyCheerGuide: remove }));
vi.mock("@/server/auth/request-context", () => ({
  getRequestAuthorization: async () => ({ context: {} }),
}));
vi.mock("@/shared/lib/sentry", () => ({ logger: { error: vi.fn() } }));
import { DELETE } from "./route";
const id = "019a0170-0000-7000-8000-000000000001";
const request = (origin = "http://127.0.0.1:3001") =>
  new Request(`http://localhost/api/admin/cheer-guides/${id}`, {
    method: "DELETE",
    headers: { Origin: origin },
  });
beforeEach(() => {
  vi.clearAllMocks();
  remove.mockResolvedValue(undefined);
});
it("동일 Origin의 유효한 삭제는 body 없는 204다", async () => {
  const response = await DELETE(request(), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(204);
  expect(await response.text()).toBe("");
  expect(remove).toHaveBeenCalledWith({}, id);
});
it("잘못된 Origin·ID는 서비스에 전달하지 않는다", async () => {
  expect(
    (await DELETE(request("https://other.invalid"), { params: Promise.resolve({ id }) })).status,
  ).toBe(403);
  expect((await DELETE(request(), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
  expect(remove).not.toHaveBeenCalled();
});
it.each([
  ["UNAUTHENTICATED", 401],
  ["FORBIDDEN", 403],
  ["CHEER_GUIDE_NOT_FOUND", 404],
  ["CHEER_GUIDE_HAS_HISTORY", 409],
] as const)("%s를 안전한 HTTP 오류로 전달한다", async (code, status) => {
  remove.mockRejectedValue(new AppError(code));
  const response = await DELETE(request(), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({ code });
});
