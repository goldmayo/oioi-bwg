"use server";
// src/shared/feature-flag/server/withFeatureFlag.ts
import { notFound } from "next/navigation";

import { type FeatureFlagKey, isFeatureEnabled } from "./feature-flag";

/**
 * Server Action 또는 API Route를 감싸는 Feature Flag 래퍼 (Guard 대체재)
 */
export function withFeatureFlag<T extends (...args: never[]) => never>(
  flagKey: FeatureFlagKey,
  handler: T,
) {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    // 1. 플래그가 꺼져있으면 즉시 404를 반환/throw 하여 숨김 처리
    if (!isFeatureEnabled(flagKey)) {
      notFound();
      // API Route(Route Handler)에서 Response를 직접 반환해야 한다면 아래처럼 분기할 수도 있습니다.
      // return new Response("Not Found", { status: 404 });
    }

    // 2. 켜져있으면 본래의 핸들러 실행
    return handler(...args);
  };
}
