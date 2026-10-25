---
title: "P06-F1 운영 빌드와 www URL 준비 결과"
kind: migration-result
status: partial
authority: evidence
source_commit: 4d5e42dac37aeb13b3279b47a7907fbb7bc91be2
created_at: "2026-10-22"
updated_at: "2026-10-25"
---

# P06-F1 결과

**최신 실행 상태:** [2026-10-25 실제 운영 전환](#2026-10-25-실제-운영-전환)이 아래 초기 준비·회수 기록을
갱신한다. 정상 paired 배포와 www origin TLS는 완료했으며 Console 실물 확인·DNS 전환·레거시 종료는 남았다.

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

| 명령/방법                                             | 실제 결과                                              |
| ----------------------------------------------------- | ------------------------------------------------------ |
| `pnpm type-check`, `pnpm lint`, `pnpm lint:fsd`       | 성공, workspace 타입/lint 각각 실제 6 task·캐시 0      |
| `pnpm test:harness`                                   | 46/46 성공                                             |
| `pnpm test:unit:run`                                  | 99파일/700건 성공, 실제 5 task·캐시 0                  |
| `pnpm test:ops`                                       | 22파일/287건 성공                                      |
| `pnpm format:check`, `git diff --check`               | 성공                                                   |
| `pnpm build --concurrency=1 --force --env-mode=loose` | 양 앱 실제 2 task·캐시 0 성공, standalone 진입점 확인  |
| local build의 robots 산출물                           | localhost sitemap URL 확인                             |
| 운영 안내 format·로컬 링크                            | format 성공, PLAN/운영 안내의 로컬 링크 대상 27개 확인 |

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

## 2026-10-25 실제 운영 전환

사용자가 #199 CI 통과 후 병합·정상 Promotion·운영 credential을 사용하는 VM/DB 읽기 점검·www TLS·
DNS 전환·검증 뒤 두 옛 Web Worker와 staging/preview 종료까지 명시적으로 승인했다.
DB 데이터·MFA 키/version·R2/assets/Console/독립 relay는 보존한다. 승인된 범위에서만 실행했다.
원문 토큰·비밀번호·OTP·cookie·개인키는 이 문서나 GitHub artifact에 기록하지 않는다.

### 통합·이력 연결과 정상 배포

- #199의 [전체 Verify](https://github.com/goldmayo/oioi-bwg/actions/runs/40165554364)가 성공한 뒤
  `31cd5b55683436714dc950402df20c44f33cd49d`로 squash 병합했다.
- 과거 squash 배포 조상 때문에 정상 merge tree가 달라지는 문제는 파일 변경 0개의
  [#245](https://github.com/goldmayo/oioi-bwg/pull/245)로 해결했다. 자동 승인 검토의 최초 차단 뒤 사용자가
  이 PR 한 건의 이력 연결·일반 merge·즉시 설정 원복을 별도로 승인했다.
  [전체 Verify](https://github.com/goldmayo/oioi-bwg/actions/runs/40166734732) 성공 후 일반 merge한
  `541f02d5c353424b1bd616030a8e016c8547f8f3`의 파일 tree는 그대로다.
  저장소 merge 설정 세 항목과 migration_main ruleset의 writable 필드 전체를 저장한 원본과 대조해 원복했다.
- 정상 [Promotion #246](https://github.com/goldmayo/oioi-bwg/pull/246)의
  [전체 Verify와 ARM64 paired candidate](https://github.com/goldmayo/oioi-bwg/actions/runs/40167421715)가 성공했다.
  source/test-merge/squash tree는 모두 `a4279947f56be84f5b90b050218a39f437a91b38`이다.
  squash 결과는 `3727f94517ab3890afabdc72f69d52ee1b27223d`다.
- [Deploy promotion](https://github.com/goldmayo/oioi-bwg/actions/runs/40168460344)이 exit 0으로 성공했다.
  immutable `paired-deployment-40168460344-1`의 candidate/receipt와 실제 VM 두 digest를 대조했다.
  기존 #193 성공 receipt의 baseline과 현재 공개 build 설정 hash도 병합 전에 대조했다.

| 앱      | 실제 실행·검증한 digest                                                   |
| ------- | ------------------------------------------------------------------------- |
| Web     | `sha256:1442a9a8bd25c06e199ebbcbb102e68e02df1190856c0907c62a657c33f4f296` |
| Console | `sha256:cb156dafa844ee1dc650b12d79f865ea3bab443ecc7303c5e3fe7ada5bd8670c` |

두 앱 모두 source `541f02d5c353424b1bd616030a8e016c8547f8f3`에서 새로 빌드했다.
`NEXT_PUBLIC_APP_ENV=production`의 공개 build hash는
`e305c103b10021bbf347f2b65b6eb350780fc628d142e0617c792f6d3ce47366`이다.
두 앱은 healthy·네 loopback health/readiness는 200이며 DB container ID/시작 시각은 불변이다.
Console의 HTTPS origin·enrollment=false와 기존 R2 endpoint/bucket/assets 입력·credential 존재를 확인했다.

### 콘텐츠 기준과 보존

기존 www의 공개 Vinext Flight JSON을 JSON으로만 파싱해 25곡·1,223 lyric line을 VM의 짧은 READ ONLY
콘텐츠 조회와 비교했다. 옛 DB credential을 찾는 로컬 env 탐색은 자동 승인 검토에서 범위를 벗어났다고
차단해 실행하지 않았다. 대신 공개 응답과 승인된 현재 VM만 비교했다. 옛 비공개 회원 데이터 일치를 주장하지 않는다.

- VM에는 `bad-habit`이 추가로 있다. 세 곡의 응원 segment/flag가 다르다.
  `ceremony`는 VM 수정 시각이 최신이고, `soda`·`free-dumb`은 기존 www 수정 시각이 최신이다.
  두 버전의 공개 비교 자료를 보존했다.
- `blue-whale`은 VM의 숨김 앨범에 속해 공개 service가404를 반환한다. 데이터는 삭제하지 않았다.
- 사용자가 위 차이를 확인하고 **현재 VM을 정식 www 기준으로 전환**한다고 명시적으로 선택했다.
  옛 DB·Hyperdrive·keep-alive Worker는 보존하며 콘텐츠 이관·덮어쓰기·seed·계정 변경을 수행하지 않는다.
- 배포 후 같은 비소유자 credential의 READ ONLY transaction으로 26곡·7앨범 전체 row가 배포 전과 같고,
  계정 1개·MFA 활성/version 4가 유지됨을 대조했다. 암호 hash·MFA 암호문은 조회하지 않았다.
  원래 참조하던 이미지 7개의 공개 URL은 모두200이다.

### 호스트·TLS와 실제 공개 검사

사용자가 sudo 비밀번호를 자기 터미널에서 입력해 보호 백업·최신 host asset upgrade·Console public R2 입력과
서버 내 RSA 개인키/CSR 준비를 완료했다. 이때 두 앱과 DB는 교체하지 않았고 이후 정상 Promotion이 새 환경을 생성했다.
기존 Auth/MFA/R2 secret mapping과 Console origin/enrollment 입력은 보존했다.

Cloudflare의 제한된 token으로 DNS·SSL·인증서 목록을 읽어 변경 전 snapshot을 저장했다.
Full (strict)를 유지하고 서버 CSR로 www/apex Origin CA 인증서 한 장을 발급했다.
인증서의 서명·두 hostname·CSR public key 일치와 만료일을 검증했으며 개인키는 서버 밖으로 옮기지 않았다.
유효기간은 2027-10-25 06:04 UTC까지다.

처음 Caddy 적용은 한 줄 `handle` block이 Caddy2.6 parser에서 거절돼 적용 전 멈췄다.
여러 줄 문법으로 수정한 뒤 같은 서버 바이너리의 실제 구문 검사를 통과했고 사용자 재실행으로 validate/reload에 성공했다.
기존 Console route는 동일하며 www/apex를 올바른 SNI·Origin CA 신뢰로 외부에서 조회해 직접 원본403을 확인했다.

새 preview의 홈·곡 화면·robots/sitemap·health/readiness·관리/인증/쓰기/Next-Action 거절 15개 검사,
26곡의 공개 DTO/숨김404와 7앨범·이미지 검사를 통과했다. metadata/robots/sitemap은 최종 www를 사용한다.
Console 실제 사전 인증 cookie의 Secure/HttpOnly/Lax·host-only와 www 요청에 cookie가 안 붙는 것을 확인했다.
Python urllib의 공개 hostname 요청은403이었고 일반 curl은200이었다. WAF를 바꾸지 않고 curl로 실제 검사를 수행했다.
인증된 session cookie·실제 로그인/목록/로그아웃·R2 업로드는 사용자 브라우저 확인 대기다.

### 남은 실행

Console 실제 인증·독립 이미지 한 건 업로드/확인/정리 후 www/apex Worker Custom Domain을 해제해
기존 VM의 Proxied A로 전환한다. 최종 www 검사 성공 뒤에만 옛 Web Worker 두 개·staging/preview DNS·
Caddy preview route·옛 배포 workflow와 전용 token 저장을 종료한다. R2/assets·Console·메일 DNS·독립 Worker·DB는 보존한다.
