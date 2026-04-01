# Feature Flag 가이드 (Front + Back)

## 1. 목적

- 개발/실험 기능을 운영에서 안전하게 비활성화한다.
- 비활성화 시 API, 모듈 로딩, TypeORM 엔티티 로딩까지 함께 차단한다.

---

## 2. 운영 원칙

- 서버 제어 플래그는 서버 전용 env(`FF_*`)를 사용한다.
- 프론트 UI 제어는 공개 env(`NEXT_PUBLIC_*`)를 사용한다.
- 기본값은 항상 `false`(Fail Closed)로 둔다.
- `DEV_*` 플래그는 운영(`NEXT_PUBLIC_APP_ENV=production`)에서 강제로 `false` 처리한다.

예시:

```env
NEXT_PUBLIC_APP_ENV=production
FF_DEV_CAREON=false
NEXT_PUBLIC_FF_DEV_CAREON=false
```

---

## 3. Next.js App Router / 환경변수 주의사항

- `next start`로 실행하면 개발 서버/운영 서버 모두 `NODE_ENV=production`으로 동작할 수 있다.
- 따라서 환경 구분은 `NODE_ENV`가 아니라 `NEXT_PUBLIC_APP_ENV`(`development`/`production`)로 한다.
- `NEXT_PUBLIC_*`는 빌드 시 클라이언트 번들에 주입되므로 민감한 서버 제어에 사용하지 않는다.
- App Router의 서버 컴포넌트/Route Handler는 `process.env`를 읽는다.

---

## 4. 공통 플래그 유틸 (`feature-flag.ts`)

파일: `libs/common-lib/src/feature-flag/feature-flag.ts`

```ts
export const FEATURE_FLAGS = {
  DEV_CAREON: "FF_DEV_CAREON",
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

const FEATURE_FLAG_VALUES: Record<FeatureFlagKey, string | undefined> = {
  // 서버 env 우선, 레거시 public env fallback
  DEV_CAREON: process.env.FF_DEV_CAREON ?? process.env.NEXT_PUBLIC_FF_DEV_CAREON,
};

const IS_REAL_PROD = process.env.NEXT_PUBLIC_APP_ENV === "production";

export const isFeatureEnabled = (key: FeatureFlagKey, defaultValue = false): boolean => {
  if (IS_REAL_PROD && key.startsWith("DEV_")) return false;
  const value = FEATURE_FLAG_VALUES[key];
  if (value === undefined) return defaultValue;
  return value === "true";
};
```

---

## 5. Backend 사용법 (Next.js App Router)

Next.js 환경에서는 서버 액션(Server Action), 라우트 핸들러(API Route), 그리고 미들웨어(Middleware)를 통해 제어합니다.

### 5.1 미들웨어(Middleware) 경로 차단 (가장 강력함)

특정 경로 하위의 모든 접근을 차단하려면 `middleware.ts`에서 제어합니다.
컴포넌트 렌더링 시작 전에 원천 차단되므로 보안성이 가장 뛰어납니다.

```ts
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isFeatureEnabled, type FeatureFlagKey } from "@/shared/feature-flag/feature-flag";

const FEATURE_FLAG_ROUTES: Record<string, FeatureFlagKey> = {
  "/careon": "DEV_CAREON",
  "/api/careon": "DEV_CAREON",
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 하위 경로까지 한 번에 차단 검사 (ex: /careon/123)
  const matchingKey = Object.keys(FEATURE_FLAG_ROUTES).find((route) => pathname.startsWith(route));

  if (matchingKey) {
    const flagKey = FEATURE_FLAG_ROUTES[matchingKey];
    if (!isFeatureEnabled(flagKey)) {
      // 404 페이지로 강제 라우팅하여 없는 엔드포인트처럼 취급
      request.nextUrl.pathname = "/404";
      return NextResponse.rewrite(request.nextUrl);
    }
  }

  return NextResponse.next();
}
```

### 5.2 Server Action 고차 함수(HOF) 래퍼 패턴

특정 Server Action 함수나 API 핸들러 단위로 통제할 때 사용합니다. 단일 액션/API에 적용하여 실행 자체를 막습니다.

```ts
// src/shared/feature-flag/server/withFeatureFlag.ts
import { notFound } from "next/navigation";
import { isFeatureEnabled, type FeatureFlagKey } from "../feature-flag";

export function withFeatureFlag<T extends (...args: any[]) => any>(
  flagKey: FeatureFlagKey,
  handler: T,
) {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    if (!isFeatureEnabled(flagKey)) {
      notFound();
    }
    return handler(...args);
  };
}
```

적용 예시 (Server Action):

```ts
"use server";
import { withFeatureFlag } from "@/shared/feature-flag/server/withFeatureFlag";

export const executeCareonTask = withFeatureFlag("DEV_CAREON", async (data) => {
  return { success: true };
});
```

### 5.3 단언(Assertion) 패턴

단순히 파일 내부 로직 중 특정 시점에서 실행 흐름을 완전히 끊고 싶을 때 삽입합니다.

```ts
// src/shared/feature-flag/server/assertFeatureFlag.ts
import { notFound } from "next/navigation";
import { isFeatureEnabled, type FeatureFlagKey } from "../feature-flag";

export function assertFeatureFlag(key: FeatureFlagKey) {
  if (!isFeatureEnabled(key)) {
    notFound();
  }
}
```

적용 예시 (Server Component / Server Action 내부):

```tsx
import { assertFeatureFlag } from "@/shared/feature-flag/server/assertFeatureFlag";

export default async function CareonPage() {
  assertFeatureFlag("DEV_CAREON");
  return <div>실험 기능 페이지</div>;
}
```

---

## 6. Frontend 사용법 (Next/React)

프론트는 보안 경계가 아니라 UI/UX 제어 목적이다.

### 6.1 UI 노출 제어

```tsx
import { Feature } from "@/components/Feature";

return (
  <Feature flag="DEV_CAREON" fallback={null}>
    <CareonSection />
  </Feature>
);
```

`<Feature />` 예시:

```tsx
import { ReactNode } from "react";
import { FeatureFlagKey, isFeatureEnabled } from "@common-libs/feature-flag";

interface FeatureProps {
  flag: FeatureFlagKey;
  fallback?: ReactNode;
  children: ReactNode;
}

export const Feature = ({ flag, fallback = null, children }: FeatureProps) => {
  return isFeatureEnabled(flag) ? <>{children}</> : <>{fallback}</>;
};
```

### 6.2 API 호출 제어

```ts
const enabled = isFeatureEnabled("DEV_CAREON");

const query = useQuery({
  ...qmCareon.fnGetList({ params }),
  enabled,
});
```

---

## 7. 프론트/서버 플래그 분리 전략

- 서버 차단/엔티티/모듈 제어: `FF_DEV_CAREON`
- 프론트 UI 노출 제어: `NEXT_PUBLIC_FF_DEV_CAREON`
- 코드에서는 서버값 우선 + public fallback으로 동작하도록 유지할 수 있다.
- 단, 보안/접근통제는 반드시 서버 플래그 기준으로 판단한다.

---

## 8. 체크리스트

- [ ] `NEXT_PUBLIC_APP_ENV`가 배포 환경별로 정확히 주입되는가
- [ ] `FF_DEV_CAREON`이 운영에서 `false`인가
- [ ] 차단된 기능의 URL 경로가 `middleware.ts` 라우트 맵퍼에 잘 선언되어 있는가
- [ ] 미들웨어 통제로 잡히지 않는 개별 내부 API나 액션은 `withFeatureFlag`나 `assertFeatureFlag`로 래핑/방어되어 있는가
- [ ] 프론트는 `NEXT_PUBLIC_*`만 사용하고 서버 제어는 하지 않는가

## 9 tips

### 언제 미들웨어를 쓰고 언제 함수 래퍼(withFeatureFlag)를 쓸까요?

둘은 상호 보완적으로 쓰기 좋습니다.

#### 미들웨어 (middleware.ts)

사용처: 특정 웹 페이지(View) 단위를 가릴 때, 혹은 그 페이지 하위의 수많은 API 라우트들을 일괄적으로 차단할 때.
장점: 컴포넌트 렌더링 단계조차 진입하지 못하게 아예 HTTP 레벨에서 막아버리므로 보안상 철저하고 서버 비용이 가장 낮습니다.

#### 단언(assertFeatureFlag) / 래퍼 함수(withFeatureFlag)

사용처: 페이지는 열려 있지만, 그 안에서 동작하는 특정 버튼용 Server Action 하나만 차단해야 하거나, 백그라운드 DB 접근 로직만 세밀하게 통제하고 싶을 때.
장점: 화면을 완전히 보이지 않게 막지 않고, 개별 API나 액션 함수 단위로 스위치를 통제할 수 있습니다.
