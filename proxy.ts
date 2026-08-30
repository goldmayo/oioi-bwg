import { NextResponse } from "next/server";

import { auth } from "./src/auth";

/**
 * 관리자 경로의 UX용 사전 인증 검사다.
 * 실제 인증·인가는 RequestContext와 서비스 경계에서 다시 수행한다.
 */
export default auth((request) => {
  if (!request.auth) {
    const loginUrl = new URL("/admin-login", request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
