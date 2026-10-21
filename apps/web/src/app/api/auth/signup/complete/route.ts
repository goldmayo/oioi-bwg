import { apiErrorResponseSchema } from "@oioi-bwg/contracts/error";

// P06-E: 공개 가입 접수를 종료한다. 본문·OTP·메일·계정 service에 접근하지 않는다.
export function POST() {
  return Response.json(
    apiErrorResponseSchema.parse({ code: "FORBIDDEN", message: "현재 회원가입을 받지 않습니다." }),
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}
