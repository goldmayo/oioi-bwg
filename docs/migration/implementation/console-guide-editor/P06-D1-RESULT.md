---
title: "P06-D1 운영자 CLI 실행 경계 구현 결과"
kind: migration-result
status: partial
authority: evidence
source_commit: ed19b6d9f033009349708dc35cb7bed2cd7be5cd
created_at: "2026-10-21"
---

# P06-D1 결과

**최신 상태(2026-10-21 17:44 KST):** 운영 VM에 CLI 실행 파일·번들을 설치하고 보호 백업 키의
복원·실제 MFA 암호문 복호화를 확인했다. 운영자 config 생성·MFA reset·실물 재등록·회수 검증은 미실행이다.
현재 계정/MFA와 Console HTTPS 공개를 유지한다. D 전체는 여전히 미완료이며 아래 실제 설치 결과를 따른다.

[P06 계획 §6](P06-PLAN.md#6-https등록운영자-경계)의 운영자 CLI 경계를 구현했다.
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
