/** 호출자가 허용한 경로 안의 상대 URL만 복귀 주소로 사용한다. */
export function safeReturnPath(
  input: string | string[] | undefined,
  fallback: string,
  allowedPaths: readonly string[],
) {
  if (typeof input !== "string" || !input.startsWith("/") || /[\\\s]/.test(input)) return fallback;
  try {
    const url = new URL(input, "https://return.invalid");
    if (url.origin !== "https://return.invalid" || !allowedPaths.includes(url.pathname))
      return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
