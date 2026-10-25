---
title: "P06-D1 운영자 CLI 실행 경계 구현 결과"
kind: migration-result
status: complete
authority: evidence
source_commit: ed19b6d9f033009349708dc35cb7bed2cd7be5cd
created_at: "2026-10-21"
---

# P06-D1 결과

**최신 상태(2026-10-21 22:34 KST):** 실제 운영자 CLI reset(version 3→4), 초기화 전 세션의 401,
사용자의 새 인증기 등록·새 로그인과 관리 API 200을 확인했다. 원래 HTTPS 설정과 외부 등록 차단을
복원했고 Console 공개를 재개했다. 사용자가 일반 브라우저의 HTTPS 로그인·관리 조회·로그아웃 후 재접근 차단도 확인했다.
아래 기존 미실행 표시는 당시 기록이며 이번 실증 결과로 갱신한다.

[P06 계획 §6](https://github.com/goldmayo/oioi-bwg/blob/e93ae610169e4ce0e9b7f1a75a9a02cbf179d46f/docs/migration/implementation/console-guide-editor/P06-PLAN.md#6-https등록운영자-경계)의 운영자 CLI 경계를 구현했다.
기준은 위 integration commit이며 실제 구현·검증 commit은 이 결과를 포함한 PR head다.
초기 구현에서는 실제 VM 설치·MFA reset·공개 접근 변경·Promotion을 수행하지 않았다.
이 문장의 설치 상태는 아래 2026-10-21 실제 설치 결과로 갱신한다. 당시 검증 이력은 보존한다.

- 기존 로컬 전용 CLI의 DB 검증과 mutation 실행을 추출해 운영 worker가 같은 service를 사용한다.
  로컬 scope/URL 제한과 예상 version·role·status 기반 transaction은 유지한다.
- 별도 bundle은 개인 SSH 운영자의 root 보호 launcher/config를 통해 실행한다.
  개인 UID·VM machine hash·현재 release/container/image·bundle·DB 재시작 시각·닫힌 Caddy 설정을 pin한다.
  deployment lock, loopback/non-root/healthy/등록 닫힘을 확인하고 컨테이너 내부 app DB credential만 사용한다.
- 사유·승인 참조·개인 UID·UTC·요청 hash를 보호된 감사 파일에 fsync한 뒤 실행한다.
  동일 요청 재실행을 막고 결과 불확실 시 자동 재시도하지 않는다.
  HTTP·일반 배포 workflow·ocarun sudoers에 mutation 경로를 추가하지 않았다.
- 직접 esbuild 의존성만 추가했고 기타 lockfile resolution 변경은 포함하지 않았다.
  자세한 설치·검토·복구 사용법은 [운영 안내 §10](../../../../ops/oci/README.md#10-console-운영자-cli-p06-d-운영-실증-전)에 둔다.

## 실제 검증

- type-check·lint·unit: `pnpm verify`의 해당 단계 성공, unit 482건. harness 18건 성공.
- `pnpm lint:fsd`, `pnpm format:check`, `pnpm build`: 성공. 두 앱 build 캐시 0.
- 새 CLI 명시적 strict TypeScript 검사 성공. Linux UID 함수 존재 검사를 보완했다.
- ops 213건: jq PATH 누락과 동시 build 중 fixture 시간 초과를 확인한 뒤,
  기존 jq 경로를 포함해 `vitest run --config vitest.ops.config.ts --maxWorkers 1`로 전체 성공.
- `tsx scripts/run-postgres-integration-tests.ts --local`: 격리된 PostgreSQL 17에서 33건 성공.
  동시 reset, access 회수·복귀, stale DB fingerprint와 transaction rollback 포함.
  종료 후 연결/잠금 0, 임시 DB와 역할 정리 완료.
- host guard fixture는 로컬 파일 권한·link·중복 감사 파일과 mock Docker/Caddy를 검사한다.
  실제 standalone bundle을 host stdin loader로 실행해 잘못된 scope/대상/입력을 거부했다.
  이것은 VM에서의 mutation 실증이 아니다.

## 남은 D 운영 검증

C의 HTTPS 로그인 증거를 마친 뒤, 검토한 bundle/config의 실제 host 설치·대상 대조가 필요하다.
실물 OTP의 reset 전 세션 → CLI reset → 기존 JWT 401 → 재등록 → 새 로그인 → 등록 차단과
관리 CRUD·키/설정 복구 증거를 이어서 확보한다. reset 뒤 이전 MFA version을 복원하지 않는다.
E 코드는 별도 PR에서 준비하되 실제 적용은 Console 운영 검증 이후다. F는 사용자 귀가 후로 보류한다.


## 2026-10-21 최신 통합선 반영

기준 `e2631de9161dd58612706151dc9517f3fe8d8910`을 반영해 로그인 UX 수정·캐시 축소·관리자 자동 E2E 제외와
임시 B0 workflow 폐기를 포함했다. 운영자 실행 정책·service mutation·host 설치 경계는 변경하지 않았다.
frozen lockfile 설치와 새 bundle 생성은 성공했다. 새 head/CI 결과는 #167 본문에서 추적한다.
코드 통합 검증과 실제 운영 실증은 구분한다. 이번 최신화는 VM 설치·MFA reset/재등록·서비스 차단을 실행하지 않으며
D 전체 완료 조건은 기존 실물 회수·재등록·복구 증거 그대로다.


## 2026-10-21 실제 VM 설치와 보호 백업 키 복원 검증

사용자의 D/E 완료 작업 지시로 통합 source `70bfe32e844c08291f964c00677f0d39c45079eb`의
운영자 CLI를 설치했다. 실제 앱은 Promotion #182의 source `9e09077ac4949b4b105582a1c3c759a3f9515e48`,
release `fc0724f78cde54ac4096b90951a104e45f2bc27792564cb3bf88e4c76b38b2f8`를 유지한다.

- 설치 전 bundle provenance의 공통 서버 파일 8개를 실제 배포 source와 대조해 모두 일치했다.
  bundle SHA-256은 `c6d20f910a2a3a4acab2ad147a1a95b1c2803d9815eccb1aadab91bea14144a6`이다.
- 개인 운영자의 sudo로 `/usr/local/lib/oioibawige/console-operator.py`(root, 0755),
  `console-operator.cjs`(root, 0600), 감사 디렉터리 `/var/lib/oioi-console-operator`(root, 0700)를 설치했다.
  launcher SHA-256은 `3caf4293104e991fd3eb4182f08dd26def63b57c6f7df6a34412de63ad82380d`다.
  설치 전 파일 부재·현재 release/container/Caddy hash·pending 부재를 확인하고 배포 lock 아래 작업했다.
- 보호된 기존 backup의 Console 키 두 개가 현재 키와 일치했다. backup에서 별도 root 0600 임시 파일로
  키를 복원하고, 실제 배포 source와 동일한 crypto 구현으로 현재 활성 MFA 암호문 복호화에 성공했다.
  복원 임시 파일은 제거했다. 키·암호문·복호화 결과·비밀번호는 로그나 로컬 증거에 기록하지 않았다.
- DB 조회는 non-owner app role의 `BEGIN READ ONLY`와 statement/lock timeout을 사용했다.
  전후 계정·MFA 대조가 같았고 MFA는 활성/version 3이다. DB mutation·runtime key 교체·OTP 생성은 하지 않았다.
- 설치와 복원 검증은 각각 08:38:57Z, 08:41:54Z에 exit 0이었다.
  root 증거는 `/var/lib/oioi-p06-de-20261021/installation.json`과 `recovery-validation.json`,
  로컬 증거는 운영 worktree의 ignored `.local/p06-de-operations/`에 있다.

회사 PC의 브라우저·인증 앱은 사용 가능하나 해당 PC에서 VM SSH는 불가능하다고 사용자가 확인했다.
비공개 재등록 화면에 도달할 경로가 확정되기 전에는 MFA를 초기화하지 않는다.
`/etc/oioibawige/console-operator.json`도 아직 만들지 않았다. 실제 중단 시점의 release/container/DB/Caddy를
다시 대조해 생성해야 하며, 현재 공개 Caddy hash를 닫힌 상태의 승인값으로 기록하지 않는다.
다음은 SSH 터널을 사용하는 브라우저 접근 확보 → 예정된 Console 중단 안내 → 고정 config → CLI reset →
이전 JWT 거절·실물 재등록·새 로그인 → 등록 닫힘·HTTPS 복귀·관리/서비스 복구 확인이다.
이번 키 파일 복원·복호화 성공을 위 전체 흐름이나 실행 중 서비스의 복구 완료로 대신하지 않는다.


## 2026-10-21 실물 MFA 회수·재등록과 HTTPS 설정 복원

사용자가 작업 PC 브라우저와 인증 앱을 함께 사용할 수 있음을 확인한 뒤 실행했다.
배포 pair는 #182의 source `9e09077ac4949b4b105582a1c3c759a3f9515e48`와 위 release를 유지했다.
자동화 Chromium의 공개 URL에서는 Cloudflare 확인이 반복되어, D의 승인된 SSH loopback 절차를 사용했다.
Cloudflare 규칙이나 인증 보호를 완화하지 않았다. HTTPS 최종 확인은 사용자의 일반 브라우저에서 수행한다.

- 외부 Console HTTP/HTTPS를 403으로 닫고, 같은 Console 한 개만 origin=`http://127.0.0.1:3001`,
  enrollment=false로 재생성했다. Web·DB의 ID/시작 시각과 두 image digest는 유지했다.
- 사용자가 기존 인증기로 직접 로그인한 실제 세션의 관리 API 200을 확인했다. 세션은 검증 프로세스의
  메모리에서만 보관했으며 비밀번호·OTP·QR·cookie 값을 로그나 artifact로 저장하지 않았다.
- 현재 개인 UID·VM·release·닫힌 Caddy·Console container·bundle·DB 재시작 시각을 pin한 root 0600 config와
  승인 참조 `P06-D/20261021-user-home-resume`의 요청을 만들었다. 설치된 정식 운영자 CLI가 13:27:27Z에
  reset을 한 번 실행해 version 3→4, 기존 MFA 비활성·암호문 폐기를 확인했다. Account/권한은 보존했다.
- reset 이전의 실제 세션으로 다시 보낸 관리 API 요청은 401이었다. 외부 차단을 유지하면서 localhost 등록을
  열었고 사용자가 새 QR을 직접 인증기에 등록했다. confirm 200과 새 로그인 후 관리 API 200을 확인했다.
- 13:34:41Z에 보호 백업의 원래 Console env를 복원하고 같은 이미지로 재생성했다. HTTPS origin,
  enrollment=false, 원래 Compose config hash, current-pair env와의 byte 일치를 확인했다.
  setup/confirm POST는 403, 두 앱 health/readiness는 200이었다. 기존 Caddy 공개 설정과 canonical hash를
  복원했고 Web·DB는 재시작하지 않았다. MFA version 4와 새 등록은 유지했으며 DB snapshot을 되돌리지 않았다.
- 전체 관리자 브라우저 E2E는 사용자 요청대로 다시 실행하지 않았다. 이번 수동 실증은 실제 회수·재등록·로그인·
  관리 조회·설정 복구에 한정한다. 기존 로컬 CRUD 회귀 증거를 운영 DB의 CRUD 실행으로 표현하지 않는다.

root 증거는 `/var/lib/oioi-p06-d-completion-20261021/`의 phase marker·reset 결과·restored.json,
정식 CLI 감사 기록은 `/var/lib/oioi-console-operator/`가 소유한다. 비밀값 없는 브라우저/원격 결과는
운영 worktree의 ignored `.local/p06-de-completion/`에 보관한다. 최초 Caddy 후보 검증은 umask로
후보 읽기 권한이 부족해 활성 설정 변경 전에 중단했고, 파일 mode를 명시한 뒤 같은 원본 상태에서 재개했다.

일반 브라우저의 최종 결과는 사용자가 새 인증기 로그인·관리 목록 조회·로그아웃·재접근 시 로그인 요구를
직접 확인해 회신했다. localhost 검증용 Chromium과 SSH 터널은 종료했다. D의 회수·실물 재등록·동일 키/
HTTPS 설정 복구 검증을 완료했다. C의 인증 쿠키 속성·preview 격리 중 자동으로 관찰하지 못한 항목은
이 수동 확인으로 대신 성공 처리하지 않으며 최종 hostname 검증에서 별도로 대조한다.

E 차단 설치 시 사용이 끝난 운영자 config를 root 보호 증거로 보관하고 `/etc/oioibawige/console-operator.json`에서 제거했다.
후속 운영 mutation은 당시의 release/container/DB/Caddy를 다시 대조해 새 pin config와 승인 요청을 만들어야 한다.
