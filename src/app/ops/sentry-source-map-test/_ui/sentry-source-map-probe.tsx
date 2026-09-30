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
    <main>
      <h1>Sentry source map verification</h1>
      <p>배포된 client bundle에서 의도적인 오류를 만들어 Sentry로 전송합니다.</p>
      <p>표시되는 event ID로 원본 TSX frame 복원을 확인하세요.</p>

      <button type="button" onClick={handleProbe}>
        Source map probe 전송
      </button>

      {eventId ? (
        <div>
          <p>Sentry event ID</p>
          <code>{eventId}</code>
        </div>
      ) : null}
    </main>
  );
}
