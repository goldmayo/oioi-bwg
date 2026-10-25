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


## 2026-10-23 기존 준비 커밋 회수 — F 전환 보류

`a595cca`의 production build 입력·www 기준 URL 준비 변경을 검토하고 원격 보존·Draft PR로 연결한다.
위 2026-10-22의 로컬/운영 관찰은 당시 기록이며 이번 회수의 새 운영 검증으로 계산하지 않는다.
현재 F 전환은 **보류**다. 이 Draft는 준비 코드 검토만 요청하며 production/www 적용·DNS·Caddy·
Cloudflare·Worker 종료·배포는 실행하거나 승인하지 않는다. 실제 서비스 완료 상태를 되돌리지 않는다.

검토 worktree는 `.local/worktrees/recovery-f-cutover`이며 원래 커밋을 amend/재작성하지 않았다.
이번 검증에는 임시 local 입력·빈 DSN·업로드/telemetry OFF·접속 불가능한 loopback DB와 임시 Console 키를 사용한다.
실제 production candidate digest·TLS/라우팅·운영 알림·이미지별 소스맵 복원은 미검증이다.

이번 직접 실행은 workspace 12 task·캐시 0개, unit 81파일·410건, repo 타입/lint·harness 18건·
FSD·ops 21파일·262건·format 모두 성공했다. 두 앱 실제 build도 2 task·캐시 0개로 성공했다.
명령은 `pnpm exec turbo run type-check lint test --concurrency=2`, repo 타입/lint, harness, FSD,
ops, format을 순서대로 실행한 뒤 `pnpm build --force --env-mode=loose --concurrency=1`을 실행했다.
로그는 저장소 밖 `/tmp/oioi-monorepo-recovery-20261023-0b6s5a9k/validation-f/`에 둔다.
commit/push hook 결과는 PR에 별도로 기록한다. www robots 산출물의 URL도 로컬 파일에서 확인한다.


## 2026-10-25 모노레포 개선 이후 F 재개와 로컬 검증

사용자의 P06 완료 지시로 F 준비 보류를 해제했다. #199 기존 브랜치에 최신 통합선
`c6c2f71b73235caa773de2ef56d51820b9e86b23`을 merge했고 과거 커밋을 재작성하지 않았다.
검증 구현은 `15c6f21301abff20af564cd597db0669c836a692`다. 아래는 이 구현의 실제 검증이며
2026-10-22/23 기록이나 운영 배포 성공을 재사용한 판정이 아니다.

### 실제 변경

- 초기 F1의 일반 CI production 전환은 최신 환경 계약으로 대체했다. workflow는 현재 통합선과
  동일하며 일반 CI/local은 local, 운영 Promotion 후보만 production을 유지한다.
- local URL은 localhost를 유지하고 최종 공개 metadata·sitemap·robots는 www 설정을 공유한다.
  기존 환경별 metadata 회귀 검사의 기대값과 Runtime §12의 최종 URL 계약을 함께 갱신했다.
- 앱별 prune·공통 blob cache·Sentry·paired Promotion은 유지한다.
  [운영 안내](../../../../ops/oci/web-cutover.md)에 데이터/파일 비교·Console R2·TLS/라우팅·
  정상 승격·레거시 종료 순서와 보존 대상·실패 복구를 기록했다.

### 직접 실행한 검증

Node 22.16.0·pnpm 10.15.1에서 frozen offline 설치에 성공했다. 앱의 개인 env 파일은 없었고
운영 credential·DB 연결·Sentry 전송/업로드를 사용하지 않았다. 로그는 이 worktree의 ignored
`.local/p06-f-resume/`에 보존한다.

| 명령/방법 | 실제 결과 |
| --- | --- |
| `pnpm type-check`, `pnpm lint`, `pnpm lint:fsd` | 성공, workspace 타입/lint 각각 실제 6 task·캐시 0 |
| `pnpm test:harness` | 46/46 성공 |
| `pnpm test:unit:run` | 99파일/700건 성공, 실제 5 task·캐시 0 |
| `pnpm test:ops` | 22파일/287건 성공 |
| `pnpm format:check`, `git diff --check` | 성공 |
| `pnpm build --concurrency=1 --force --env-mode=loose` | 양 앱 실제 2 task·캐시 0 성공, standalone 진입점 확인 |
| local build의 robots 산출물 | localhost sitemap URL 확인 |
| 운영 안내 format·로컬 링크 | format 성공, PLAN/운영 안내의 로컬 링크 대상 27개 확인 |

Build는 allowlist로 구성한 임시 process env·local 입력·빈 DSN/분석 ID·전송/업로드 OFF·
접속 불가능한 loopback DB·임시 Console 키를 사용했다. `--env-mode=loose`는 이 제한된 env만
전달했으며 운영 env/실제 candidate 검증을 뜻하지 않는다. production의 www URL은 기존
환경별 metadata unit 검사에서 확인했고 실제 production image/공개 응답 검증은 남았다.
첫 Web test 명령의 추가 인자는 현재 runner에서 필터로 적용되지 않아 Web 전체 31파일/180건이
실행돼 성공했다. 위 unit 700건에는 이 검사가 포함된다.

구현 commit hook의 lint-staged(ESLint fix/Prettier)·commitlint가 성공했다. push hook과 원격 CI는
PR #199에 별도로 실제 결과를 기록한다. 로컬 Docker/운영 DB integration·전체 관리자 E2E는 미실행이다.

### 공개 관찰과 아직 남은 실행

2026-10-25 credential 없는 HTTPS 읽기에서 www/apex/preview/staging 홈과 Console 로그인 화면은
각각 200이었다. assets 루트의404는 object 조회나 업로드 실패 판정으로 사용하지 않았다.
공개 sitemap GET은 www 26개, preview/staging 각각27개였고 host를 제외한 path 비교에서
VM에 `/songs/bad-habit` 하나가 더 있었다. Worker에만 있는 path는 없고 preview/staging path 집합은
같았다. 이 관찰만으로 전체 DB·파일 일치나 최신성/데이터 보존을 확정하지 않는다.

운영 VM/Cloudflare와 필요한 DB의 읽기 대조, Console R2 주입·실제 업로드, 정상 ARM64 후보·배포,
www origin 인증서/SNI/라우팅·apex redirect, 최종 cookie/조회·인증 거절 확인, 두 옛 Web Workers와
staging/preview 종료는 아직 미완료다. DNS 변경 전에 실제 www origin TLS를 확인한다.
