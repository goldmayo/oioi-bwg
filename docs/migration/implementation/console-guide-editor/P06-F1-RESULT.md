---
title: "P06-F1 운영 빌드와 www URL 준비 결과"
kind: migration-result
status: partial
authority: evidence
source_commit: 4d5e42dac37aeb13b3279b47a7907fbb7bc91be2
created_at: "2026-10-22"
---

# P06-F1 결과

사용자가 F 착수와 기존 Workers 두 개 종료·preview VM의 www 연결, R2 유지를 지시했다.
[P06 계획](P06-PLAN.md#preview--www-전환과-레거시-종료)의 운영 build 입력과 최종 URL 준비를
독립 checkpoint로 수행한다. 최신 `origin/migration_main`의 위 commit에서 `feature/p06-f-cutover`를 만들었다.
상위 기준은 Runtime §8의 R2 유지, 배포 runbook §21의 동일 candidate digest 승격이다.

## 변경

- 일반 CI와 Promotion candidate의 `NEXT_PUBLIC_APP_ENV` build 입력 여섯 곳을 `production`으로 맞췄다.
  두 앱의 실제 production digest는 이 변경 통합 후 별도 정상 Promotion에서 검증한다.
- Web metadata의 기준 URL을 `https://www.oioibawige.com`으로 바꾸고 sitemap·robots가 같은
  `SITE_CONFIG.url`을 사용하도록 했다. apex→www 연결은 실제 host/Cloudflare 전환에서 다룬다.
- 기존 Promotion 브랜치·Environment·후보/배포 검증 계약은 유지한다. 브랜치 이름 정리는 별도다.

## 실제 검증

- `pnpm type-check`, `pnpm test:harness` 18건, `pnpm lint`, `pnpm lint:fsd`,
  `pnpm test:unit:run` 네 package 성공(세 package 기존 성공 캐시), `pnpm format:check` 성공.
- `pnpm test:ops` 262건 성공.
- `NEXT_PUBLIC_APP_ENV=production pnpm build`: Web·Console 모두 새 build 성공.
  실제 `apps/web/.next/server/app/robots.txt.body`의 www sitemap URL을 확인했다.
  첫 산출물 확인 helper는 같은 이름의 디렉터리까지 읽어 중단했고 정확한 body 파일 검사로 재실행해 성공했다.
- `git diff --check` 성공. 전체 관리자 E2E·운영 DB 직접 접속·데이터 변경은 실행하지 않았다.

## F 착수 시 실제 환경 확인

- 두 앱과 DB는 E의 정상 Promotion #193을 유지한다. VM의 활성 main Caddyfile에 www host가 없고,
  loopback SNI `www.oioibawige.com` TLS 검증은 SSL 오류로 실패했다. origin 인증서/라우팅 준비가 선행돼야 한다.
- 업로드 코드 `packages/server/src/storage/upload-public-asset.ts`는 R2의 S3 API를 사용한다.
  OCI Object Storage 참조는 기존 PostgreSQL 백업 용도다. storage provider 변경은 하지 않는다.
- 변수 이름이 있는 `.env.example`과 실제 runtime 주입을 구분했다. VM Web의 R2 endpoint/bucket은 빈 값,
  Console에는 해당 키가 없었다. 두 앱의 assets 공개 base URL은 기존 assets 도메인이다.
  Console 업로드에 필요한 공개 설정과 기존 Vault의 R2 secret 매핑을 준비해야 한다.
  R2 비밀 값이나 runtime DB credential을 로그에 출력하지 않았다.
- 공개 www/preview sitemap 요청은 모두 403·추가 challenge 헤더 없음으로 비교할 수 없었다.
  VM Web 직접 origin의 sitemap/robots는 200, sitemap URL은 27개였다.
  이것을 Worker/VM 데이터 최신성 일치의 근거로 사용하지 않는다. 외부 요청 경계와 콘텐츠 비교는 남아 있다.
- 기존 Wrangler OAuth token이 만료됐고 공식 CLI의 갱신도 실패했다. Cloudflare 재로그인을 요청했다.
  Worker Custom Domain 연결은 DNS 레코드 이름 변경과 구분해 해제하고 전환 후 검증해야 한다.

## 남은 실행

이 checkpoint의 로컬 build 성공은 F 완료가 아니다. 정상 Promotion의 exact ARM64 digest 검증·배포,
Console R2 설정과 업로드 검증, www origin TLS/라우팅, Worker/VM 콘텐츠·파일 대조 뒤 Cloudflare 전환을 진행한다.
그 뒤 기존 Workers 두 개·staging·preview 경로를 종료하되 R2와 assets 도메인을 보존한다.
MFA 등록 false·현재 key/version·계정 상태를 유지하고 불명확한 DB 전체 덮어쓰기를 하지 않는다.
Workers 요금제 해지와 브랜치 이름 변경은 이번 checkpoint에서 실행하지 않았다.

관찰과 Cloudflare CLI 진단은 이 worktree의 ignored `.local/p06-f/`에 보관한다.
