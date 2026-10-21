---
title: "P06 Next.js 보안 패치 구현 및 검증 결과"
kind: migration-result
status: implemented
source_commit: 6d3f4d485dd1dc791bf4c1fcd5d721d3f5bcd7a1
verified_at: "2026-10-21"
updated_at: "2026-10-21"
---

# P06 Next.js 보안 패치 결과

[승인 계획](P06-NEXT-SECURITY-PLAN.md)에 따라 두 앱의 보안 패치와 로컬 검증을 완료했다.
기준은 `origin/migration_main`의 `ed19b6d9f033009349708dc35cb7bed2cd7be5cd`,
구현 커밋은 `6d3f4d485dd1dc791bf4c1fcd5d721d3f5bcd7a1`이다.
통합 PR·CI와 실제 Promotion 배포를 구분하며, 이 로컬 결과만으로 운영 패치 완료나 P06-C 완료를 선언하지 않는다.

## 변경

| 대상 | 이전 | 변경 후 |
| --- | --- | --- |
| Web·Console Next.js | 16.3.3 | 16.4.1 |
| Web @next/third-parties·루트 eslint-config-next | 16.3.3 | 16.4.1 |
| Next가 해석하는 sharp | lock 0.35.4 | 설치·두 standalone 모두 0.35.5 |
| sharp native libvips | 패치 전 실행 버전 미확인 | 설치·두 standalone 모두 8.18.7 |

- Next·sharp 및 관련 SWC/libvips/ESLint 패키지를 lockfile에 반영했다. pnpm 재생성에 따른
  기존 항목 정렬과 jsdom 계열의 이미 존재하는 `@noble/hashes` peer 재선택이 포함된다.
  무관한 직접 의존성을 갱신하지 않았으며 React 19.2.5와 Node 22.16.0을 유지했다.
- 새 ESLint 규칙이 기존 effect의 동기 setState를 거절했다. 로그인 페이지가
  `code=rate_limited` 여부를 판별해 폼 초기값으로 전달하도록 최소 보완했다.
  동일 안내 문구·제출/취소 시 해제·hydration 전 입력 비활성화를 유지한다.
- 기존 컨테이너 native smoke에 Next/sharp 실제 버전 출력, `sharp >=0.35.5` 검사와
  PNG 변환을 추가했다. 일반 CI 및 Promotion에서 같은 검사가 실행된다.
- 브라우저 smoke에 실제 제한 URL의 안내 표시 및 다음 단계 진입 후 해제 검사를 추가했다.
  DB schema·권한·OTP·IP 제한·Cloudflare/Caddy·D/E 기능 변경은 없다.

## 실제 로컬 검증

| 실행 | 결과 |
| --- | --- |
| pnpm install --no-frozen-lockfile | 성공, pnpm 10.15.1 |
| pnpm type-check | 통과 |
| pnpm test:harness | 18건 통과 |
| pnpm lint / pnpm lint:fsd | 통과 |
| pnpm test:unit:run | 483건 통과: Web 170, Console 222, server 88, contracts 3 |
| pnpm test:ops | 211건 통과 |
| pnpm format:check | 통과, 후속 smoke·문서도 개별 검사 |
| pnpm build | 두 앱 Next 16.4.1 standalone 빌드 성공 |
| pnpm test:integration:postgres:local | PostgreSQL 17의 격리 DB에서 33건 통과, 연결/lock 0·DB 제거 |
| P04_ARTIFACT_DIR=/tmp/p06-next-security-admin pnpm test:integration:admin:local | 실제 두 standalone·Chromium·격리 DB에서 전체 통과, 임시 DB 정리 |
| node tests/ops/console-standalone-smoke.mjs http://127.0.0.1:3301 | 제한 안내·해제·CSRF 쿠키·미인증 redirect·hydration 통과 |
| 설치 및 두 standalone의 Next 경로에서 sharp 해석·2×2 PNG 변환 | Next 16.4.1 / sharp 0.35.5 / libvips 8.18.7. 산출물 외부 경로로 fallback하지 않음 |
| pnpm lint:repo / node --check tests/ops/container-native-smoke.mjs / git diff --check | 마지막 smoke 수정 후 통과 |

실제 관리자 브라우저 검증은 로그인·MFA PNG 해독/등록·동시 요청·OTP 재사용 방어,
Auth.js callback/Action 공통 제한·Origin/CSRF·로그아웃, 두 앱 앨범/곡 생성·수정·삭제,
LRC·가사 저장·세션 격리·권한 회수·재인증 후 편집 복구를 포함한다.
이는 로컬 HTTP 증거이며 실제 Cloudflare→Caddy HTTPS 검증을 대체하지 않는다.

처음 lint는 위 effect 문제로 실패한 뒤 수정·재실행했다. 첫 산출물 조회와 관리자 smoke는
Web 빌드 완료 전에 시작해 ENOENT/서버 시작 실패가 났고 임시 DB가 정리됐다.
두 빌드 완료 후 재실행해 통과했다. 브라우저의 일반 alert 선택자가 Next의 접근성 안내까지
선택한 실패는 제한 안내 문구로 범위를 좁힌 뒤 통과했다. 이 실패들을 패치의 실행 성공으로 집계하지 않았다.

`pnpm audit --prod --json`은 **exit 1**이다. 응답에서 Next/sharp 항목은 없고 critical 0,
high 20·moderate 16·low 2가 남았다. audit가 10월 공지를 누락했던 이력이 있어
[공식 보안 릴리스](https://github.com/vercel/next.js/releases/tag/v16.4.1)와 함께 판단했다.
남은 다른 의존성의 취약점·실제 도달 가능성은 별도 관심사이며 전체 보안 감사 통과를 주장하지 않는다.

로컬 원문은 이 작업 공간의 `.local/p06-next-security/`에 보존한다. 실제 관리자 테스트의
스크린샷은 같은 폴더의 `admin/`에 두며 테스트용 계정만 사용했다. GitHub CI·PR의 최신 결과와
컨테이너/ARM64 증거는 해당 PR 및 Promotion의 Actions artifact에 연결한다.

## 남은 운영 단계

통합·Promotion 전까지 운영 VM의 패치는 미적용이다. 두 앱 candidate를 새로 만들고
정상 Promotion의 동일 digest 검증·배포·receipt를 확인해야 한다. 실패 시 이전 pair로
복구할 수 있지만 16.3.3 복귀는 보안 패치 완료가 아니므로 Console 공개를 유지 보류한다.

이후 C의 HTTPS 검증 준비물을 새 container/release 기준으로 갱신한다. 기존 창3 고정 묶음을
그대로 재실행하지 않는다. 필요한 CF 규칙 수정과 Caddy HTTPS 설정은 구체 변경안으로
분리하고, 사용자 브라우저 로그인·실제 전달 IP·위조 헤더 방어를 검증한다.
Wi-Fi→5G 실험은 미실시·필수 범위 제외를 유지하며 F의 www 전환도 포함하지 않는다.
