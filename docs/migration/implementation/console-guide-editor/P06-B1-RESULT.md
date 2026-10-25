---
title: "P06-B1 두 앱 승격 후보 구현 결과"
kind: migration-result
status: active
source_commit: 9f769a9d7b1688108beec52f2c63fb3053b40666
verified_at: "2026-10-15"
updated_at: "2026-10-16"
---

# P06-B1 결과

[P06 계획](https://github.com/goldmayo/oioi-bwg/blob/e93ae610169e4ce0e9b7f1a75a9a02cbf179d46f/docs/migration/implementation/console-guide-editor/P06-PLAN.md) §4의 B1 후보 계약을 구현했다. 기준은 #146 병합
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

## 최초 구현 시점의 한계

**실제 전체 ARM64 후보 build/push/pull/smoke는 당시 실행하지 않았다.** B0 작은 marker 실증을
앱 후보 증거로 사용하지 않는다. GitHub Environment의 `OCIR_CONSOLE_REPOSITORY`는 이름 목록
읽기에서 미등록이었다. 별도 승인 후 `oioi-bwg-console` 등록과 B1 병합으로 새 Promotion source를
검증한다. 설정 절차는 [운영 안내](../../../../ops/oci/README.md#6-migration-branch-및-github-수동-설정) 참조.
#142는 OPEN이며 병합하지 않았다. B2 host/env/rollback·실제 두 앱 Metadata 검증은 다음 단계다.
운영/IAM/Secret/DB/개인 env를 변경하지 않았고 게시 최소 권한 재설계는 기존 승인된 보류를 유지한다.

## 2026-10-15 병합과 실제 후보 검증

사용자 지시로 #147의 최신 head/전체 CI 성공을 재확인한 뒤 `f31471bceb0c04d18382f05b50ee0fa11a6b6b08`에
squash 병합했다. PR 제목/본문을 squash 제목/본문으로 사용했다. 같은 지시의 다음 작업으로
`OCIR_CONSOLE_REPOSITORY=oioi-bwg-console`을 등록하고 저장 값을 대조했다. IAM·Secret은 변경하지 않았다.
#142 새 source의 [Verify 38754229290](https://github.com/goldmayo/oioi-bwg/actions/runs/38754229290)
attempt 1은 일반 verify·ARM64 candidate·promotion 전체 성공이다. 두 전체 앱 build/push 후 게시 digest
자체의 architecture·source revision·native module·readiness·browser smoke와 최종 head 재검증을 통과했다.
후보 job 완료는 한국 시간 2026-10-15 23:59:39이며 B0 marker job은 skipped다.

90일 artifact `promotion-f31471bceb0c04d18382f05b50ee0fa11a6b6b08-1`의 `candidate.json`을 내려받아
PR 142·source SHA·tree `419186a691c3db1672a24cc8e7f4ee3fed9edc8a`·run/attempt와 두 환경 repository를 대조했다.
검사에는 구현의 `assertCandidate`를 사용했고 두 게시/smoke step 성공과 artifact 미만료·보관 기간도 확인했다.

- Web: `sha256:3b506a9ac62e34683b8d5e683800d1bd9741f388768fb2a713485e9c4da0f6c7`
- Console: `sha256:8fcd77f43fb78b517c95c1d6b74d402745e3205f851c6aa4cec12bd6293a738e`

**B1의 실제 전체 ARM64 앱 후보 실증은 통과했다.** 두 digest가 한 source/run/attempt로 연결됐다.
후보 알림 step도 성공했다. 실제 VM pull·두 앱 배포/Metadata 차단·host upgrade 완료를 뜻하지 않는다.
#142는 OPEN을 유지하고 병합하지 않았다. B2 전체 구현·별도 승인된 host upgrade 전 Promotion 금지는 유지한다.
