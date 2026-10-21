---
title: "P06 Next.js 공개 전 보안 패치 계획"
status: "approved"
updated_at: "2026-10-21"
---

# P06 Next.js 공개 전 보안 패치 계획

## 범위와 기준

사용자의 보안 조사 검증 및 후속 작업·문서화 지시에 따라 Web·Console의 Next.js를
16.3.3에서 16.4.1로 갱신한다. 기준은 fetch한 `origin/migration_main`
`ed19b6d9f033009349708dc35cb7bed2cd7be5cd`이며, 새 작업은 `feature/p06-next-security`다.
D/E PR의 기능 변경은 포함하지 않는다. DB schema·인증 정책·Cloudflare/Caddy 설정도
이번 패키지 변경과 분리한다.

준거는 [헌법 §2·4](../../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md),
[Runtime §11](../../oioi-bwg-architecture-clean-v1/11-content-i18n-assets-runtime-architecture.md),
[Testing §12·17](../../oioi-bwg-architecture-clean-v1/10-testing-architecture.md),
[배포 §21](../../oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md)이다.
[P06 계획](P06-PLAN.md)의 공개 전 보안 검증을 보강하는 독립 변경 단위이며,
과거 단계의 검증 버전 기록을 소급 수정하지 않는다.

## 확인한 위험과 정정

- [10월 Server Actions DoS](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r):
  Next 16.0.0~16.4.0의 App Router와 Server Action 사용 조건. 현재 두 앱의 로그인·관리 이미지
  업로드가 해당한다. 공식 우회책은 업데이트뿐이며, 인증·OTP·Cloudflare Challenge가 패치를 대체하지 않는다.
- [TypedArray use cache RCE](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr):
  현재 Cache Components/use cache 사용을 찾지 못했다. 공식 권고는 유사 함수가 없더라도 업데이트를 권장한다.
- [SVG 이미지 RCE](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw):
  glibc 기반 Linux와 이미지 최적화 경로의 문제다. 두 앱은 `images.unoptimized=true`지만
  수정판의 실제 `sharp >=0.35.5` 해석과 빌드 산출물을 확인한다.
- [16.4.1 릴리스](https://github.com/vercel/next.js/releases/tag/v16.4.1)는 위 세 수정의 공식 근거다.
  이는 이 목록의 최소 수정판이며 향후 모든 취약점의 부재를 보장하지 않는다.
- 앞선 로컬 audit 중심 검토에서 10월 공지를 놓쳤다. 공개 전 패치를 단순 권고하던 판단을
  **현재 공개된 Web과 Console의 패치·재배포가 Console 공개보다 선행**하도록 정정한다.
  이는 영향 조건 대조이며 공격 재현·침해 확인이 아니다.
- 사용자 연혁의 16.2.11 GitHub 릴리스 시각은 7월21일 UTC다.
  [공식 기록](https://github.com/vercel/next.js/releases/tag/v16.2.11)을 기준으로 7월20일 표기만 정정한다.

## 구현 및 완료 조건

1. 두 앱 `next`, Web `@next/third-parties`, 루트 `eslint-config-next`를 16.4.1로 고정한다.
2. pnpm 10.15.1로 lockfile을 갱신하고 무관한 직접 의존성은 갱신하지 않는다.
   Next의 Node 요구사항 `>=20.9.0`과 React peer 범위에 현재 Node 22.16.0/React 19.2.5가 들어간다.
   실제 호환성은 아래 검사로 확인한다.
3. 설치된 Next와 그 경로에서 해석되는 sharp 및 standalone 포함 여부·버전을 확인한다.
4. type-check, harness, lint, lint:fsd, unit, ops, format, 두 앱 build를 실행한다.
   실제 PostgreSQL 및 기존 관리자 브라우저 통합 검증으로 로그인·MFA·CRUD·권한/세션 격리를 확인한다.
   운영 DB나 공개 서버에 공격 요청을 보내지 않는다.
5. 결과·한계·커밋·PR 근거를 [결과 문서](P06-NEXT-SECURITY-RESULT.md)에 기록하고
   `migration_main` 대상 PR로 제출한다. CI 결과를 확인한다.

## 배포와 재개 조건

lockfile 변경은 두 앱 새 이미지 빌드 대상이다. 통합 후 별도
`migration_main → migration_develop` Promotion의 검증된 두 candidate digest만 배포한다.
배포를 실제 실행하기 전 후보·복구안을 구체화하며, 통합 PR 검증을 운영 적용 완료로 표현하지 않는다.
실패 시 기존 paired rollback 계약을 따르되, 이전 16.3.3 pair로 복구하면 취약 버전이 다시
실행되므로 Console 공개를 보류하고 수정된 후보를 다시 준비한다.

새 배포는 기존 HTTPS 창3의 container/release 기준을 바꾼다. 고정 묶음을 그대로 재실행하지
않고 최신 기준으로 재검토한다. 이후 C의 실제 HTTPS 로그인·Secure 쿠키·전달 IP·위조 헤더
방어를 검증한다. Wi-Fi→5G 두 회선 실험은 계속 미실시이며 필수 완료 조건에서 제외한다.

## 실행 중 확인한 호환성 보완

16.4.1의 ESLint 설정이 사용하는 react-hooks 규칙에서 기존 로그인 폼의 effect 내 동기
상태 갱신을 거절했다. 인증 정책을 바꾸지 않고 `/admin-login?code=rate_limited`를 서버
페이지에서 판별해 폼 초기 안내로 전달한다. 안내 표시·제출 후 해제와 SSR hydration 회귀를
기존 폼 테스트에 추가한다. 이 보완은 보안 패치의 필수 lint 통과를 위한 같은 변경 단위다.
