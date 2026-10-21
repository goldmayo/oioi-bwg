---
title: "P06-E2 Web 관리 경로 종료와 복구 차단 준비 결과"
kind: migration-result
status: partial
authority: evidence
source_commit: ed19b6d9f033009349708dc35cb7bed2cd7be5cd
created_at: "2026-10-21"
---

# P06-E2 결과

**최신 상태(2026-10-21):** #189의 실제 배포·기존 범위 검증은 성공했다. 그러나 사용자는 공개 Web에
일반 로그인도 제공하지 않는다고 정정했다. 현재 `/login`과 Auth.js 경로가 남아 있으므로 **E 전체 완료 보고를 철회한다.**
D의 실물 MFA 회수·재등록·HTTPS 복구는 완료다. 기존 배포 증거를 보존하고 Web 인증 제거를 E의 남은 작업으로 처리한다.
F의 www 전환·레거시 종료로 이 제거를 미루지 않는다.
후속 인증 제거의 구현·검증·운영 적용 여부는 [E3 결과](P06-E3-RESULT.md)를 따른다.

[P06 계획](P06-PLAN.md#4-pr별-구현-순서와-완료-조건)의 Web 관리 종료 checkpoint를 구현했다.
기준은 위 integration commit, 구현 commit은 이 결과가 포함된 PR head다.
가입 API 종료는 별도 [E1 PR #168](https://github.com/goldmayo/oioi-bwg/pull/168)이다. 두 PR과 C/D 운영 증거가 갖춰진 후 실제 E를 적용한다.

## 변경

- Web의 /admin 전체, /admin-login, /api/admin/*, upload Action 및 연결된 관리 UI를 제거했다.
  Console의 관리 코드와 공용 server/contracts는 유지한다.
- 삭제한 UI가 유일한 consumer였던 관리 query/mutation과 client ability helper를 제거했다.
  공개 Album/Song DTO 조회와 cancellation/queryKey는 보존한다. Web 가사 reader는 공통 계약 type을 직접 사용한다.
- 기존 계정의 일반 로그인은 /login에서 유지한다. 로그인 UI를 route-private으로 두고,
  Auth.js Credentials HTTP API를 사용해 홈으로 이동한다. Web Server Action을 차단해도 일반 로그인이 가능하다.
- image/env rollback 밖에 유지할 [host 차단 설정과 절차](../../../../ops/oci/web-retirement.md)를 준비했다.
  관리·가입 URL, 모든 Next-Action, Auth.js callback/signout 외 쓰기를 upstream 전에 차단한다.
  실제 VM에 설치하거나 Caddy를 reload하지 않았다.
- 브라우저 smoke는 Console CRUD와 Web 거부/일반 로그인/공개 조회를 검증하도록 전환했다.
  실제 Caddy 검증을 CI의 Admin migration integration에 연결했다.

관리 경로와 그 의존 그래프를 함께 제거하므로 파일/라인 목표를 초과한다. 대부분 기존 Web 관리 복사본 삭제다.
분리 가능한 가입 종료는 E1로 분리했다. 이 checkpoint는 route/API/Action의 완전한 부재와
연결 코드 제거를 함께 검증한다. 리뷰 순서는 route/API/Action 삭제 → 일반 로그인/공개 entity API →
관리 전용 UI 삭제 → smoke → proxy/운영 절차다. 기존 Console 사본과 의존성 버전은 바꾸지 않는다.

## 실제 검증

- type-check·lint/FSD·unit 418건·harness 18건·format 성공.
- ops 211건 전체 성공. 두 앱 production build 성공; 마지막 로그인 파일 이동 뒤 Web 재빌드와 Console 검증 캐시 사용.
- `tsx scripts/run-postgres-integration-tests.ts --local --admin-smoke` 성공.
  guest/USER/ADMIN의 관리 route·API와 이전 upload Action을 거부하고 Album/Song 상태 불변을 확인했다.
  일반 USER/ADMIN 로그인, Console CRUD·가사 편집/저장·회수/재인증, 공개 Web 조회와 교차 세션 거부를 확인했다.
  종료 후 연결/잠금 0, 격리 DB/역할 정리 완료.
- 이전 upload Action ID는 2026-10-21 현재 VM Web manifest에서 해당 export만 READ ONLY로 추출했다.
  release 18462a4004780a0b43bcadf77792ef8fa22b082390498774331ed2a704a31c1a의 공개 식별자이며 credential이 아니다.
  새 build manifest에 upload Action이 없고, 이전 ID를 /·/login·/admin/albums로 보내도 404였다.
- `node tests/ops/web-retirement-proxy-smoke.mjs` 성공.
  digest로 고정한 Caddy 2.10.2가 관리/가입/encoded path/헤더 및 multipart Action을 403으로 거부했고,
  가짜 이전 upstream에 도달한 거부 요청은 0이었다. 일반 조회 및 Auth.js POST는 통과했다.
  Docker Desktop의 별도 localhost 문제를 피하도록 공식 바이너리를 추출해 같은 WSL localhost에서 검사한다.
- 로컬 browser 아티팩트는 `/tmp/oioi-p04-smoke-HAjiW8`다. 일반 로그인 화면을 별도 production 실행으로
  캡처/시각 확인했고 CI에서도 로그인 및 로그인 후 화면을 캡처한다.

## 적용 대기

C의 사용자 로그인 성공은 확인됐다. 후속 관리 조회·인증 세션/preview 격리·로그아웃과 D의 실물 인증기 reset/재등록/회수·관리·복구 증거가 남았다.
이후 실제 host에 지속적인 Web 차단을 설치하고 current/previous pair 모두에서 검증한 뒤 E Promotion을 진행한다.
안전한 previous pair가 없으면 maintenance를 유지한다. 지금은 코드/로컬 검증 준비이며 E 운영 완료가 아니다.
www 전환·레거시 종료의 F는 사용자 귀가 후로 보류한다. Console은 C에서 승인한 HTTPS 공개를 유지한다.

## 원격 CI의 artifact 경로 보완

첫 Verify 39517768992는 로컬 전체 build 디렉터리를 참조한 Web manifest 검사에서 ENOENT로 실패했다.
CI가 복원한 standalone 산출물 경로를 읽도록 수정했다. 일반 로컬 build 폴더가 없는 임시 디렉터리에서
복원 artifact만으로 검사하며, 제거 대상 Action이 들어 있으면 DB 접근 전에 거부하는 회귀 검사 두 건을 추가했다.
앱 runtime 변경은 없다. 재검증 결과와 최종 head는 PR에서 추적한다.


## 2026-10-21 보안 패치 통합 후 Action 거절 계약 보완

보안 배포를 포함한 `migration_main` f675033을 merge한 head는 `0404651c1e4849d73567bf69f73e085743abc00f`다.
이 head의 Verify39534367022에서 품질·unit419건/ops213건·PostgreSQL·두 앱 build는 성공했지만,
실제 관리 브라우저 검사는 이전 upload Action의 응답409를404와 비교해 실패했다.

설치된 Next16.4.1의 action-handler와 [공식 변경 #98123](https://github.com/vercel/next.js/pull/98123)을 대조했다.
현재 배포에 없는 정상 형식 Action ID는409와 `x-nextjs-action-not-found: 1`,
`text/plain`의 `Server Action unavailable.`로 거절한다. 이전404 기대값을 이 정확한 상태·헤더·본문
검사로 교체했다. 제거된 관리 route/API의404, manifest의 Action 부재, Album/Song 불변 검사는 유지한다.
앱 동작이나 Caddy403 차단 정책을 변경하지 않았다. 위 최초404 기록은 당시16.3.3 결과다.

같은 CI head의 성공한 `ci-standalone` artifact12316128962를 내려받아 경로/멤버를 대조하고,
실제 Web runtime이16.4.1임을 확인한 뒤 수정한 smoke로 `pnpm test:integration:admin:local`을 실행했다.
guest/USER/ADMIN의 이전 Action 거절·일반 로그인, Console MFA/CRUD·가사 저장·세션 회수와
공개 조회 회귀가 모두 성공했다. 임시 DB/역할 정리, 연결/잠금0을 확인했다.
근거는 ignored `.local/p06-e2-security-refresh/admin-recheck.log`와 실제 브라우저 산출물이다.
이 보완의 최종 source/CI head는 기존 PR #169에서 추적하며 운영 VM의 E 적용은 계속 보류한다.


## 2026-10-21 최신 CI 정책 반영

통합 기준 `e2631de9161dd58612706151dc9517f3fe8d8910`을 반영했다. workflow 충돌은
기존 E2의 관리자 E2E 뒤 Caddy 검사 연결과 사용자가 요청한 해당 job 제거가 겹친 부분이다.
현재 통합선의 workflow를 유지해 관리자 전체 E2E를 다시 추가하지 않는다. Caddy 검사 도구와
이전 실제 통과 증거는 유지하며 필요할 때 명시적으로 실행한다. 캐시 축소·임시 B0 job 폐기도 유지한다.
Web 관리 종료 코드·일반 로그인·Console 기능·host 차단 정책은 변경하지 않았다.
새 CI의 고정 head/결과는 #169 본문에서 추적하며 이전 통과를 새 기준의 통과로 대신하지 않는다.
VM/Caddy 적용·계정/MFA 변경·Promotion은 실행하지 않았다. D 실물 운영 검증과 E 배포 조건은 남아 있다.

최신화 검토에서 E 운영 안내의 과거 Console 외부 차단 문구도 C 지속 공개 계획에 맞췄다.
D 실증 후 승인된 Console 공개를 유지하며 E의 Web 차단을 Console route에 적용하지 않는다.
실제 host 설정은 변경하지 않았다.


## 2026-10-21 VM의 차단 후보 검증

통합 source `70bfe32e844c08291f964c00677f0d39c45079eb`의 `web-retirement.caddy`를
root 보호 검토 디렉터리 `/var/lib/oioi-p06-de-20261021/source`에 보관했다.
파일 SHA-256은 `c68aeb730949f899eca96c3062d6b432022e7fc1169bf63419c1c5b66a70bb82`다.

- 실제 Caddyfile의 preview 블록만 차단 import → 기존 reverse_proxy 순서로 바꾼 후보를 만들었다.
  Console import는 유지했다. VM의 Caddy 2.6.2에서 `caddy validate`와 `caddy adapt`가 성공했다.
- 별도 임시 Caddy를 127.0.0.1의 임시 포트에만 실행하고 현재 Web으로 전달했다. 관리 로그인/API,
  가입 OTP/완료 POST, Next-Action POST, form Action POST의 6종 요청은 모두 403이었다.
  `/`, `/healthz`, `/readyz`, `/api/auth/csrf`, `/api/auth/session`은 모두 200이었다.
  기존 `/api/auth/signin`도 200이며 차단된 `/admin-login`으로 리다이렉트하지 않았다.
- 검증 프로세스는 종료했다. 활성 Caddy 설정 hash와 실제 두 앱은 바뀌지 않았다.
  `/etc/caddy/web-retirement.caddy` 설치·Caddy reload·회원가입/관리 mutation·E Promotion은 하지 않았다.
  이 검사는 전체 관리자 브라우저 E2E가 아니며 해당 자동 CI job을 다시 추가하지 않았다.
- 08:44:14Z exit 0 증거는 root의 `/var/lib/oioi-p06-de-20261021/private-guard-proof.json`과
  운영 worktree의 ignored `.local/p06-de-operations/preview-guard-*.json`에 있다.

검사한 이전 Web 후보는 현재 정상 release `fc0724f78cde54ac4096b90951a104e45f2bc27792564cb3bf88e4c76b38b2f8`다.
실제 hostname의 차단 및 current/previous pair 로그인·복구 확인을 완료했다고 주장하지 않는다.
[D 실제 설치 결과](P06-D1-RESULT.md#2026-10-21-실제-vm-설치와-보호-백업-키-복원-검증)의
비공개 재등록·회수 실증을 마친 뒤 활성 차단과 정상 Promotion을 진행한다. F는 보류한다.


## 2026-10-21 지속 차단 설치와 이전 pair 검증

[D 실물 회수·재등록](P06-D1-RESULT.md#2026-10-21-실물-mfa-회수재등록과-https-설정-복원)과
사용자의 일반 브라우저 HTTPS 로그인·관리 조회·로그아웃 확인 후 E 적용을 시작했다.
기준 pair는 #182 release `fc0724f78cde54ac4096b90951a104e45f2bc27792564cb3bf88e4c76b38b2f8`다.

- root 소유 `/etc/caddy/web-retirement.caddy`(0644)에 검토한 guard를 설치했다.
  SHA-256은 `c68aeb730949f899eca96c3062d6b432022e7fc1169bf63419c1c5b66a70bb82`다.
  현재 Caddyfile의 preview 블록에만 `route { import ...; reverse_proxy ... }` 순서를 적용했다.
  caddy 사용자로 전체 설정 검증 후 reload했고, Console active 파일과 세 container는 그대로였다.
- 13:39:56Z 실제 preview origin TLS 요청에서 관리/login/API·encoded admin·가입 API 세 개·Next-Action·
  헤더 없는 multipart Action을 모두 403으로 확인했다. 일반 페이지·health/readiness·CSRF/session은 200,
  HTTP 관리 요청은 HTTPS로 308이었다. Caddy canonical hash는
  `8dcb9081ca0513bb3b93d4f4be60eeaf870b208bc09863076c2f0277e7674b01`이다.
- 외부 preview에서도 가입·Next-Action·form POST는 challenge 없는 403, 일반 페이지·Auth.js signin/CSRF는
  200이었다. 관리 GET은 기존 Cloudflare challenge 403이므로 이를 origin 차단 증거로 대신하지 않았다.
  origin 차단은 위 실제 Caddy TLS 요청으로 확인했다. Cloudflare 규칙은 변경하지 않았다.
- 사용자가 이전 Web의 `/api/auth/signin`에서 기존 계정으로 로그인하고 `/api/auth/signout`에서 로그아웃했다.
  첫 시도 실패 뒤 사용자가 재시도 성공을 확인했다. 최초 실패 원인은 미확정이며 비밀번호 오입력으로 단정하지 않는다.
  아직 배포하지 않은 새 이미지의 결과와 구분한다. 계정·비밀번호를 새로 만들거나 변경하지 않았다.
- 사용이 끝난 D 운영자 pin config는 보호 증거 경로로 보관하고 실행 경로에서 제거했다.
  CLI/감사 증거와 새 MFA version 4는 유지한다. 이전 version/DB를 복원하지 않는다.
- 파일 변경 0개 #188을 필수 CI 성공 후 이번 PR 한정 사용자 승인으로 일반 merge했다.
  결과 `4ca2e43befa6a141c5a5f7810d6a0968ac18e2ec`의 tree는 기존 main과 같고,
  repository/main ruleset의 두 merge 설정은 즉시 원복·대조했다. #189는 이 source의 정상 Promotion이다.

host 증거는 `/var/lib/oioi-p06-e-completion-20261021/`의 보호 백업·installed.json,
외부 요청과 사용자 확인은 운영 worktree의 ignored `.local/p06-de-completion/`가 소유한다.
호스트 차단은 image/env snapshot 밖에 있으며 배포/복구 스크립트가 이 파일이나 Caddyfile을 복원하지 않음을
코드로 대조했다. 기존 pair의 실제 차단·일반 인증 검증을 안전한 복구 기준으로 사용한다.
이번 작업에서 고의 장애를 일으켜 전체 pair rollback을 다시 실행한 것으로 주장하지 않는다.


## 2026-10-21 E 정상 Promotion과 최종 검증 완료

- Promotion [#189](https://github.com/goldmayo/oioi-bwg/pull/189)는 source
  `4ca2e43befa6a141c5a5f7810d6a0968ac18e2ec`를
  `36af6b633bd8bdee14b8369ca5159698d6c274d2`로 정상 squash했다.
  source/검증 merge/실제 squash tree는 `e1e4e764b95d25880b64ab7fba1bd5806e9c64b4`로 같다.
- Verify [39609292177](https://github.com/goldmayo/oioi-bwg/actions/runs/39609292177) attempt 1에서
  필수 정적·unit/ops·PostgreSQL·app/container build와 두 exact ARM64 image의 동시 smoke가 성공했다.
  관리자 전체 E2E job을 다시 추가하거나 재실행하지 않았다.
- candidate artifact `12350496227`, Deploy
  [39611154318](https://github.com/goldmayo/oioi-bwg/actions/runs/39611154318) attempt 1 exit 0,
  receipt artifact `12350361866`을 대조했다. release는
  `dfcab8238945ba9b2623319c108501d4011dbe8ac2bb3af4e100865ad0a0b971`이다.
- 실제 Web digest는 `sha256:9760f848033ed52135ca301fa77413b21c85bf364c51cd03fff8a0ab502eb11b`,
  Console digest는 `sha256:ea661e4730b90108cabf972cde18018a190069eedcf6f026b0bde517cac426e5`다.
  두 이미지는 위 source에서 새로 build됐으며 배포 전 검증한 digest와 같다. 이전 pair는 실제 검증한 #182다.
- 13:52:15Z VM 검증에서 current/previous candidate, 실제 image, runtime env와 snapshot 일치,
  두 앱 health/readiness 200, host guard와 Caddy hash 유지, DB container/시작 시각 불변을 확인했다.
  새 MFA 활성/version 4·HTTPS origin·enrollment=false와 setup/confirm 403도 유지됐다.
- 새 Web 직접 origin에서 `/login` 200, `/admin`·`/admin-login`·`/api/admin/albums` 404,
  가입 API 세 개의 malformed POST도 403이었다. 실제 이전 upload Action ID의 multipart 요청은
  409/`x-nextjs-action-not-found: 1`/정확한 unavailable 본문으로 거절됐다.
  첫 임시 검증은 임의 ID와 빈 body를 사용해 이 계약 대조에서 중단했다. 기존 성공한 회귀 검사와 동일한
  실제 이전 ID·Origin·multipart 요청으로 바로잡아 통과했다. 앱이나 배포 코드를 바꾸지 않았다.
- 공개 preview에서 가입/Next-Action/form POST는 challenge 없는 403, `/`·`/login`·CSRF는 200이었다.
  사용자가 새 `/login` 화면의 로그인·홈 조회·로그아웃 성공을 직접 확인했다. 이전 pair의 확인과 별도로 기록했다.

E의 preview Web 관리/가입 종료를 완료했다. F의 www 전환·레거시 종료와 G 계정 관리 구현은 미실행이다.
실제 인증 세션 cookie 속성/preview 격리 중 미관찰 항목은 성공으로 바꾸지 않으며 최종 hostname 검증에 남긴다.
추가 DB migration·dump 복원·계정 생성·MFA key/version rollback은 하지 않았다.


## 2026-10-21 사용자 범위 정정 — E 완료 보고 철회

사용자는 preview가 비로그인 공개 사용자 페이지이고 인증·관리는 Console의 책임이라고 명확히 지시했다.
초기 P06 계획(commit `382049d`)의 E 완료 조건·복구 설명에는 일반 로그인 유지가 있었고,
E1 `2fd67f7`은 Domain AUTH-001에, E2 `70bfe32`는 헌법 §5와 `/login` 구현에 그 전제를 반영했다.
이는 현재 사용자 지시와 충돌한다. 문서가 존재한다는 이유로 로그인 기능을 보존하거나 사용자의 의도를 바꾸지 않는다.

위 성공 결과는 당시 일반 로그인 유지 범위의 사실이다. 공개 Web 인증 제거 완료를 의미하지 않는다.
다음 수정은 상위 헌법·Auth·Domain·P06 계획을 먼저 같은 기준으로 개정한 뒤 Web `/login`, Auth.js handler,
세션/권한 API와 사용이 끝난 Web 인증 연결을 제거한다. 실제 host에서도 로그인/인증 경로와 Auth.js POST 예외를
차단해 과거 이미지로 복구해도 다시 열리지 않게 한다. 공개 콘텐츠 조회와 Console MFA·계정/DB는 보존한다.
검증은 Web 비로그인 조회·로그인/인증 거절·Console 보존을 기준으로 바꾸며, 전체 관리자 E2E는 재도입하지 않는다.
