import React from "react";

import { FeatureFlagKey, isFeatureEnabled } from "./feature-flag";

interface FeatureProps {
  /** 확인할 피처 플래그 키 */
  flag: FeatureFlagKey;
  /** 활성화 시 렌더링할 UI */
  children: React.ReactNode;
  /** 비활성화 시 노출할 대체 UI (UI 파편화 방지 및 하위 호환성 유지) */
  fallback?: React.ReactNode;
}

/**
 * [Decoupling Wrapper] 피처 플래그에 따른 조건부 렌더링 컴포넌트
 *
 * 이 컴포넌트는 비즈니스 로직과 기능 노출 여부를 분리하는 '가드' 역할을 합니다.
 * 코드 전반에 걸친 if-else 분기 처리를 줄이고, 선언적으로 기능을 제어하기 위해 사용합니다.
 *
 * @example
 * <Feature flag="RELEASE_NEW_PAYMENT_UI" fallback={<LegacyPayment />}>
 *   <NewPaymentSystem />
 * </Feature>
 */
export function Feature({ flag, children, fallback = null }: FeatureProps) {
  const enabled = isFeatureEnabled(flag, false);

  if (!enabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
