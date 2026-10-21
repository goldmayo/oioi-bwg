---
title: "P06-D1 운영자 CLI 실행 경계 구현 결과"
kind: migration-result
status: partial
authority: evidence
source_commit: ed19b6d9f033009349708dc35cb7bed2cd7be5cd
created_at: "2026-10-21"
---

# P06-D1 결과

[P06 계획 §6](P06-PLAN.md#6-https등록운영자-경계)의 운영자 CLI 경계를 구현했다.
기준은 위 integration commit이며 실제 구현·검증 commit은 이 결과를 포함한 PR head다.
실제 VM 설치·MFA reset·공개 접근 변경·Promotion은 수행하지 않았다. D 전체는 미완료다.

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
