import { AppError } from "@oioi-bwg/server/errors/app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorization: vi.fn(),
  list: vi.fn(),
  read: vi.fn(),
  report: vi.fn(),
}));
vi.mock("@/server/auth/request-context", () => ({ getRequestAuthorization: mocks.authorization }));
vi.mock("@/server/observability/server-error-reporter", () => ({
  reportServerError: mocks.report,
}));
vi.mock("@oioi-bwg/server/services/notification-service", () => ({
  listNotifications: mocks.list,
  readNotification: mocks.read,
}));
import { PATCH } from "./[id]/read/route";
import { GET } from "./route";

const id = "019a1234-5678-7000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CONSOLE_ORIGIN", "http://127.0.0.1:3001");
  mocks.authorization.mockResolvedValue({
    context: { user: { id } },
    decision: "authorized",
    rejectionLogged: false,
  });
  mocks.list.mockResolvedValue({ items: [], nextCursor: null, unreadCount: 0 });
});
describe("알림 HTTP boundary", () => {
  it("목록 입력을 검증하고 사용자별 응답을 캐시하지 않는다", async () => {
    const response = await GET(
      new Request("http://127.0.0.1:3001/api/admin/notifications?limit=2"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.list).toHaveBeenCalledWith({ user: { id } }, { limit: 2 });
  });
  it("잘못된 cursor는 service 호출 전에 거절한다", async () => {
    const response = await GET(
      new Request("http://127.0.0.1:3001/api/admin/notifications?cursor=bad"),
    );
    expect(response.status).toBe(400);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("읽음 변경의 잘못된 Origin을 거절한다", async () => {
    const response = await PATCH(
      new Request(`http://127.0.0.1:3001/api/admin/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Origin: "https://other.invalid" },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("타 계정 알림의 존재를 공개하지 않고 예상 실패를 변환한다", async () => {
    mocks.read.mockRejectedValue(new AppError("NOTIFICATION_NOT_FOUND"));
    const response = await PATCH(
      new Request(`http://127.0.0.1:3001/api/admin/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Origin: "http://127.0.0.1:3001" },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: "NOTIFICATION_NOT_FOUND",
      message: "알림을 찾을 수 없습니다.",
    });
  });
  it("인증 조회의 예상 밖 실패도 내부 정보를 숨긴다", async () => {
    mocks.authorization.mockRejectedValue(new Error("secret SQL"));
    const response = await GET(new Request("http://127.0.0.1:3001/api/admin/notifications"));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret");
    expect(mocks.report).toHaveBeenCalled();
  });
});
