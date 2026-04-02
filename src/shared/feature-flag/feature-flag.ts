/**
 * Feature Flag 운영 원칙
 *
 * 1) 수명 관리
 * - 플래그는 임시 제어 수단이다.
 * - 릴리즈 후 불필요해진 플래그는 제거 일정을 잡아 정리한다.
 *
 * 2) 네이밍
 * - 용도를 접두사로 구분한다.
 *   - `RELEASE_`: 단기 릴리즈 제어
 *   - `DEV_`: 개발/실험 기능 제어
 *   - `OPS_`: 운영 정책 제어
 *
 * 3) 분리(Decoupling)
 * - 비즈니스 코드 전역에 `if (isFeatureEnabled(...))`를 흩뿌리지 않는다.
 * - UI는 `<Feature />` 같은 래퍼로, 서버는 Guard/모듈 로딩 단계에서 제어한다.
 *
 * 4) 환경변수 정책
 * - 서버 제어 플래그는 서버 전용 env를 사용한다.
 * - 기본값은 `false`(Fail Closed)로 동작한다.
 *
 * 5) Next.js App Router env 주의사항
 * - `next start`로 서버를 띄우면 개발/운영 모두 `NODE_ENV=production`으로 동작할 수 있다.
 * - 따라서 운영 분기는 `NODE_ENV`가 아닌 `NEXT_PUBLIC_APP_ENV`(development/production)로 제어한다.
 * - `NEXT_PUBLIC_*` 값은 클라이언트 번들에 주입되므로 민감 제어에 사용하지 않는다.
 */

export const FEATURE_FLAGS = {
  /**
   * [RELEASE] 단기 릴리즈 제어용 플래그
   * - 기능 안정화 후 제거 대상
   */
  // RELEASE_NEW_PAYMENT_UI: 'NEXT_PUBLIC_FF_RELEASE_NEW_PAYMENT_UI',

  /**
   * [DEV] 개발/실험 기능 제어용 플래그
   */
  // DEV_EXPERIMENTAL_CHART: 'NEXT_PUBLIC_FF_DEV_EXPERIMENTAL_CHART',
  DEV_CAREON: 'FF_DEV_CAREON',
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

/**
 * Flag별 env 값 매핑
 * - App Router 서버 런타임에서 읽히는 값
 */
const FEATURE_FLAG_VALUES: Record<FeatureFlagKey, string | undefined> = {
  // Prefer server flag, fallback to public flag for frontend visibility control.
  DEV_CAREON: process.env.FF_DEV_CAREON ?? process.env.NEXT_PUBLIC_FF_DEV_CAREON,
};

const IS_REAL_PROD = process.env.NEXT_PUBLIC_APP_ENV === 'production';

/**
 * 플래그 활성 상태를 반환한다.
 * - 운영(NEXT_PUBLIC_APP_ENV=production)에서 DEV_* 플래그는 강제 false
 * - env 값이 없으면 defaultValue 사용
 */
export const isFeatureEnabled = (key: FeatureFlagKey, defaultValue: boolean = false): boolean => {
  if (IS_REAL_PROD && key.startsWith('DEV_')) {
    return false;
  }

  const value = FEATURE_FLAG_VALUES[key];

  if (value === undefined) return defaultValue;
  return value === 'true';
};
