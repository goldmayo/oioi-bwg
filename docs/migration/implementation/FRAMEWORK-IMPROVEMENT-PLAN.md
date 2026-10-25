---
title: "프레임워크 활용 감사 후속 개선 계획"
kind: migration-plan
status: completed
source_commit: b45e97145bd5e86044aa1f53bcdfb056f79d4b33
created_at: "2026-10-23"
revision: 2
---

# 프레임워크 활용 감사 후속 개선 계획

## 근거와 범위

사용자가 #218 병합 후 [감사 문서](FRAMEWORK-STRUCTURE-AUDIT.md) 기반 작업을 승인했다.
local/origin migration_main의 위 기준과 깨끗한 작업 트리를 확인했다.
[헌법 §11](../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md),
[Rendering §29.1·32](../oioi-bwg-architecture-clean-v1/07-rendering-query-cache-architecture.md),
[Error UX §5.1·17·18](../oioi-bwg-architecture-clean-v1/09-error-ux-observability.md),
[Testing](../oioi-bwg-architecture-clean-v1/10-testing-architecture.md)를 따른다.
기존 [관측 결과 §6](OBSERVABILITY-ERROR-TRACKING-RESULT.md)의 최초 mount 보고와 중복 억제는 보존한다.
실행 결과는 별도 [결과 문서](FRAMEWORK-IMPROVEMENT-RESULT.md)가 소유한다.

## 단위 A — FWA-01/02 오류 복구

- 세 Next 오류 화면의 버튼을 설치된 Next 16.4.1의 retry prop에 연결한다.
  서버 payload 갱신을 자체 router wrapper로 재구현하지 않는다.
- Console AppProviders에 QueryErrorResetBoundary를 두고 AdminError에서 Query reset 후 Next retry를
  호출한다. QueryClient는 기존 lifecycle을 유지하며 자동 retry 횟수·mutation 정책은 변경하지 않는다.
  root layout을 대체하는 global-error는 provider가 없으므로 Next retry만 사용한다.
- 완료 조건: 실제 오류 화면·provider와 설치된 Next 경계에서 재시도 연결을 검증하고, 캐시 없는
  Suspense Query의 일시적 실패가 다시 시도 후 성공하는 회귀 테스트를 남긴다.
  StrictMode/재렌더의 관측 중복 억제와 오류 digest 전달을 보존한다.
- 기본 gate·두 앱 local production build·최종 head CI/리뷰 후 migration_main으로 squash한다.
  실제 RSC 요청 재조회는 로컬 격리 fixture로 검증하며 mock과 실제 browser/server 실행을 구분한다.

## 단위 B — FWA-03 앨범 Dialog

A 병합 후 최신 migration_main에서 시작한다. 기존 앱의 Dialog primitive를 재사용해 dialog naming,
Escape·바깥 클릭·focus trap/복원·scroll lock과 GSAP 퇴장 생명주기를 연결한다.
직접 URL·onClose·기존 홈 이동 동작은 보존하고 parallel/intercepting route 재설계는 포함하지 않는다.
Playwright로 실제 키보드/포커스·닫기와 애니메이션 완료를 검증하고 기본 gate·build·CI 후 squash한다.
UI-03 패키지 추출과 Radix 전체 교체는 별도 보류 범위다.

## 단위 C — FWA-04 순수 관측 정책 공통화 설계

B 병합 후 최신 소스로 순수 정책과 앱 adapter의 경계를 정한다. 정제 allowlist·원문 비노출·capture
중복 처리·SDK와 route metadata의 소유권을 보존한다. 설치된 SDK 기본 옵션으로 계약을 대체하지 않는다.
감사에서 승인된 산출물은 설계다. 공통 package/export·client/server 경계·계약 테스트와 전환 순서를
구체화하고, 별도 architecture 결정이나 범위 확대가 필요하면 그 지점을 명시한다.
설계 산출물과 이후 구현의 canonical plan은 [순수 관측 정책 공통화 계획](OBSERVABILITY-POLICY-SHARING-PLAN.md)이다.

## 공통 제외와 검증 원칙

#199는 기존 head의 Draft로 유지한다. F/www·운영/Worker 배포·실제 외부 전송·메일/계정 재활성화와
UI-03은 포함하지 않는다. 후속 구현을 미리 쌓지 않으며 각 단위 최종 diff의 로컬 검증·CI를 사용한다.
CI 링크만 추가하기 위한 문서 commit은 만들지 않는다. 과거 감사의 발견 시점/재현 한계를 보존한다.
