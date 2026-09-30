"use client";

import { useState } from "react";

import { captureClientException } from "@/shared/lib/sentry";

function throwSentrySourceMapProbe(): never {
  throw new Error("SENTRY_SOURCE_MAP_PROBE");
}

export function SentrySourceMapProbe() {
  const [eventId, setEventId] = useState<string | null>(null);

  function handleProbe() {
    try {
      throwSentrySourceMapProbe();
    } catch (error) {
      setEventId(captureClientException(error, { source: "sentry-auto-capture" }));
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-muted-foreground text-sm font-medium">OCI staging operations probe</p>
        <h1 className="mt-2 text-2xl font-bold">Sentry source map verification</h1>
        <p className="text-muted-foreground mt-3 text-sm leading-6">
          아래 버튼은 배포된 client bundle 내부에서 의도적인 오류를 만들고 Sentry로 전송합니다.
          표시되는 event ID로 Sentry에서 해당 이벤트를 찾아 원본 TypeScript/TSX frame 복원을 확인하세요.
        </p>
      </div>

      <button
        type="button"
        onClick={handleProbe}
        className="w-fit rounded-md border px-4 py-2 text-sm font-semibold"
      >
        Source map probe 전송
      </button>

      {eventId ? (
        <div className="rounded-md border p-4">
          <p className="text-muted-foreground text-xs">Sentry event ID</p>
          <code className="mt-2 block break-all text-sm">{eventId}</code>
        </div>
      ) : null}
    </main>
  );
}
