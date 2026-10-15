---
title: "P06-B1 두 앱 승격 후보 구현 결과"
kind: migration-result
status: active
source_commit: 9f769a9d7b1688108beec52f2c63fb3053b40666
verified_at: "2026-10-15"
---

# P06-B1 결과

[P06 계획](P06-PLAN.md) §4의 B1 후보 계약을 구현했다. 기준은 #146 병합
`152d2a008ee620adcdf118b957e9ca945644113f`이며 `feature/p06b1-paired-candidate`에서 작업했다.
PR 번호·push hook·원격 CI 결과는 생성 후 PR 본문에서 추적한다.

하나의 source SHA/tree/run/attempt에 고정 `images.web`·`images.console` repository/digest를 기록한다.
각 ARM64 게시 digest의 architecture·revision·native module·readiness·browser smoke 후에만
90일 artifact를 생성하고 두 digest를 summary/Slack에 보고한다. 기존 source/merge tree·최신 성공 run·
pre-merge check·artifact 대조를 유지한다. 단일 이미지 이전 형식·누락·중복·추가 앱·다른 repository는 거절한다.
B0 marker 게시는 비활성화했다. B2/승인된 host upgrade 전에는 후보 대조 이후 OCI 인증/Run Command
전에 명시적으로 실패한다. 기존 단일 digest transport를 그대로 호출해 부분 배포하지 않는다.

직접 실행한 `pnpm type-check`, `pnpm test:harness`(18건), `pnpm lint`, `pnpm lint:fsd`,
`pnpm test:unit:run`(459건·캐시 0), `pnpm format:check`, `pnpm build`(두 앱·캐시 0)가 성공했다.
harness 종료 후 lint를 실행했다. `pnpm test:ops`는 97건 성공이며 최초 새 기록 테스트의 JSON
속성 순서 비교 실패는 JSON 내용 비교로 수정했다. actionlint 1.7.12(배포 checksum 대조,
`-shellcheck=`)로 변경한 두 workflow 정적 검사가 성공했다. commit hook ESLint/Prettier·commitlint도 성공했다.

**실제 전체 ARM64 후보 build/push/pull/smoke는 아직 실행하지 않았다.** B0 작은 marker 실증을
앱 후보 증거로 사용하지 않는다. GitHub Environment의 `OCIR_CONSOLE_REPOSITORY`는 이름 목록
읽기에서 미등록이었다. 별도 승인 후 `oioi-bwg-console` 등록과 B1 병합으로 새 Promotion source를
검증한다. 설정 절차는 [운영 안내](../../../../ops/oci/README.md#6-migration-branch-및-github-수동-설정) 참조.
#142는 OPEN이며 병합하지 않았다. B2 host/env/rollback·실제 두 앱 Metadata 검증은 다음 단계다.
운영/IAM/Secret/DB/개인 env를 변경하지 않았고 게시 최소 권한 재설계는 기존 승인된 보류를 유지한다.
