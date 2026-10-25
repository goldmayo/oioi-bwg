---
title: "P06 선택적 이미지 재사용 구현 결과"
kind: migration-result
status: active
source_commit: 18de205ad1b187101922228dfe83678f927238d7
verified_at: "2026-10-17"
verified_source:
  repository: goldmayo/oioi-bwg
  branch: feature/p06-selective-integration
  commit: 0c4e9a01351aad0c98708e6081d4d6a3b9239c6e
---

# P06 선택적 재사용 결과

[P06 계획 개정](https://github.com/goldmayo/oioi-bwg/blob/e93ae610169e4ce0e9b7f1a75a9a02cbf179d46f/docs/migration/implementation/console-guide-editor/P06-PLAN.md#2026-10-17-선택적-재사용-개정)을 최신 main `18de205`에서 시작했다.
#147/#148 MERGED, #149 OPEN(`c19d0a7`)을 GitHub에서 확인했다. 기존 worktree·개인 env·MFA/DB는 보존한다.

첫 concern은 `promotion.mjs`의 릴리스 source와 image build source 분리, canonical pair hash,
성공 배포 receipt의 artifact/PR/tree/run/attempt/기존 verify check 검증, Turbo dry-run과 경로의 보수적 판정이다.
최신 성공 배포 증거가 없으면 오래된 CI/tag로 fallback하지 않는다. 공개 build 입력 hash가 바뀌어도 두 앱을 빌드한다.
후보 producer는 우선 두 이미지를 새 빌드하며 workflow 연결은 후속 concern이다.

후보 계약 concern에서 기본 여섯 검사와 `pnpm test:ops` 142건, `pnpm build` 두 앱이 성공했다.
harness 18건·unit 459건·unit/build 캐시 0이다. 최초 ops 실행은 PATH의 jq 부재로 실패했고,
공식 jq 1.8.2 ARM64 checksum 대조 후 임시 PATH에서 재실행해 성공했다. Turbo 2.11.7의 실제 dry-run을
읽고 dependency placeholder를 변경 앱으로 오인하지 않도록 보정했다. 변경 판정/증거 신규 테스트는 24건이다.
구현 commit과 PR/원격 CI는 PR 본문에서 추적한다. 실제 OCI/VM 배포·Terraform·Secret/DB 변경은 하지 않는다.
현재 WSL의 Docker CLI는 통합 미설정으로 실행 불가다. mock 성공을 실제 컨테이너/OCI 성공으로 간주하지 않는다.

## Workflow 연결과 최종 로컬 검증

구현 `0ec969d`는 #149 env helper·#150 후보 계약·#151 host를 결합한다. 마지막 정상 실제 배포의
candidate/receipt와 원래 verify artifact/check를 검증한 뒤 기존 Turbo graph로 앱별 build를 선택한다.
공통/미지 경로·공개 build 설정 변경·이력/분석 실패는 두 빌드다. rename 축약을 끄고 삭제/추가를 모두 본다.
Dockerfile의 기본 all builder는 보존하고 Promotion만 BUILD_APP=web/console로 해당 앱을 빌드한다.

재사용 digest의 실제 build SHA를 label과 대조한다. 두 exact image를 동시에 실행한 native/readiness/browser
smoke proof가 current run/attempt/digest/build SHA와 맞아야 단일 candidate.json을 기록한다.
Run Command 전달 전에 payload schema/digest를 확인하며 host가 baseline과 현재 pair를 다시 대조한다.
배포 exit 0 이후만 immutable 90일 receipt를 기록한다. rollback 20/21은 새 재사용 증거가 아니다.
증거가 없어 baseline=null이면 두 앱을 빌드하지만, 이미 paired VM이면 무조건 적용하지 않고 거절한다.

기본 여섯 검사·ops 154건·두 앱 build(캐시 0) 성공이다. ops에는 fake Docker/OCI host 15개 시나리오,
fake browser 조합 smoke 실패/기록 금지, 실제 Git+설치된 Turbo의 앱별/공통/rename 판정이 포함된다.
마지막 stdio/rename 보정 후 repo type/lint와 관련 테스트 26건(실제 Git/Turbo 포함)도 성공했다.
actionlint 1.7.12(-shellcheck=) 두 workflow·bash -n 여섯 script·git diff --check가 성공했다.
공식 도구 checksum을 대조하고 임시 PATH에서 사용했다. 로컬 검증에 운영 credential은 사용하지 않았다.

일반 CI에 실제 Docker Compose의 앱별 image 변경·env 변경·무변경·한쪽 실패 후 복구 검사를 추가했다.
ID/StartedAt을 실제 inspect해 비교한다. **로컬 WSL에서는 실행하지 못했으며 원격 결과는 PR 본문이 소유한다.**
#150 Verify 38926511148과 #151 Verify 38928227575는 전체 성공이다. 이 두 run은 새 Compose 검사를 포함하지 않는다.
실제 ARM64 선택적 Promotion/OCI/Vault·VM upgrade/metadata 차단·중단 후 수동 복구는 미검증이며 별도 승인 후다.
기존 배포 차단·credential 범위·#142 OPEN을 유지하고 운영 VM/Terraform/Secret/DB/개인 env를 변경하지 않았다.

## Git fixture의 hook 환경 격리 보완

첫 통합 push hook의 실제 Git fixture가 상속된 GIT_DIR 때문에 작업 브랜치/index와 공통 core.bare를
변경했다. 원격 전달 전에 push와 hook을 중단하고 작업 ref/index를 `fac8779`로, core.bare를 false로
복구했다. 원래 worktree `0011723`의 깨끗한 상태와 원격 브랜치 미생성을 확인했다. 실제 파일은 삭제하지 않았다.
`0c4e9a0`은 fixture의 Git/Turbo subprocess에서 모든 GIT_*를 제거하고 사용자 Git 설정도 격리한다.
hook 환경을 의도적으로 주입해 fixture 경계·본 저장소 HEAD/index 보존을 확인하는 회귀 검사가 성공했다.
repo type/lint도 성공했다. 이후 push hook 재실행의 실제 명령/결과는 PR 본문에서 추적한다.
