import "server-only";

export class JsonBodyError extends Error {
  constructor(readonly status: number) {
    super("JSON 요청 본문을 확인해 주세요.");
  }
}

/** 인증 후에만 읽으며 Content-Length와 무관하게 실제 byte 수와 경과 시간을 제한한다. */
export async function readBoundedJsonBody(
  request: Request,
  maximum = 4 * 1024 * 1024,
): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
  )
    throw new JsonBodyError(415);
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maximum))
    throw new JsonBodyError(413);
  const reader = request.body?.getReader();
  if (!reader) throw new JsonBodyError(400);
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new JsonBodyError(408)), 10_000);
  });
  try {
    const bytes = Buffer.alloc(maximum);
    let length = 0;
    while (true) {
      const next = await Promise.race([reader.read(), deadline]);
      if (next.done) break;
      if (length + next.value.byteLength > maximum) throw new JsonBodyError(413);
      bytes.set(next.value, length);
      length += next.value.byteLength;
    }
    return JSON.parse(bytes.subarray(0, length).toString("utf8")) as unknown;
  } catch (error) {
    throw error instanceof JsonBodyError ? error : new JsonBodyError(400);
  } finally {
    clearTimeout(timer!);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
