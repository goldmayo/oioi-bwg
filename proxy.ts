import { type NextRequest } from "next/server";

import { updateSession } from "./src/shared/api/db/supabase/middleware";

/**
 * Next.js 16 Proxy Function
 * 기존의 middleware 역할을 수행하며, 세션 갱신 로직을 호출합니다.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export default proxy;

export const config = {
  matcher: [
    /*
     * 아래 패턴을 제외한 모든 요청 경로에 적용:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화 파일)
     * - favicon.ico (파비콘 파일)
     * - public 폴더 안의 이미지 등 (svg, png, jpg 등 확장자)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
