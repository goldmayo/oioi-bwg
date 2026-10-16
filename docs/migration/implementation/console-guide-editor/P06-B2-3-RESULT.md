---
title: "P06-B2-3 paired 배포·복구 구현 결과"
kind: migration-result
status: active
source_commit: c19d0a777f41e3ef4bcab571044e64a89714d4a4
verified_at: "2026-10-17"
---

# P06-B2-3 결과

[P06 계획](P06-PLAN.md) §5의 독립 container 교체와 공동 rollback을 #149의 env helper 위에 구현했다.
최신 main `18de205`에서 분기하고 #149 head `c19d0a7`을 fast-forward로 반영했다. #149 브랜치는 변경하지 않았다.
후보 source/build source 분리는 사용자 요청을 적용하며, 상세 계약은 active 배포 runbook §19/21이 소유한다.
후보 계약 Draft #150과 host 변경은 분리하고 마지막 workflow 연결 PR에서 결합한다.

root 보호 파일·배포 lock 아래 두 env와 cross-app Secret/DB 일치·두 immutable digest/revision·Compose를
사전 검증한다. 현재 pair ID·실행 image/config hash·env drift 및 재사용 출처 불일치는 변경 전에 거절한다.
안정된 env 경로로 `up -d --wait web console`을 실행하며 공통 release metadata를 서비스 설정에 넣지 않는다.
두 앱 smoke 후 current-pair symlink를 확정한다. 실패 시 직전 snapshot의 env/Compose/설정/pair를 복구한다.
exit 0/20/21을 유지하며 pending 기록은 중단/복구 실패 후 후속 배포를 차단한다.

installer의 명시적 upgrade는 기존 Compose/script/config backup을 보존하고 기존 설정을 덮어쓰지 않는다.
첫 전환은 기존 app을 정지하고 성공 후만 제거한다. 실패 시 새 서비스를 정지하고 기존 app/digest/env를 복구한다.

기본 여섯 검사와 `pnpm test:ops` 116건, `pnpm build` 두 앱이 성공했다. harness 18건·unit 459건,
unit/build 캐시 0이다. ops 한 테스트 안에서 Python CLI fixture 15개 시나리오를 실행했다.
앱별 변경/무변경/유효 env 변경·baseline/출처/실행 drift 거절·Vault/pull/config 실패 무변경·lock·
한쪽 실패 복구·smoke 및 복구 실패 exit 21/pending 유지·최초 app 전환 성공과 복구를 확인했다.
`bash -n` 세 script와 Python AST 구문 검사가 성공했다. 구현 commit/PR·원격 CI는 PR 본문에서 추적한다. 실제 WSL Docker CLI가 실행 불가하므로 fake Docker/OCI의 ID/시작 시각
보존은 실제 Compose 증거가 아니다. 실제 OCI/VM 배포·Terraform·Secret/DB·개인 env 변경은 없다.
workflow 배포 차단과 #142 OPEN을 유지한다. 실제 host upgrade/metadata 차단·중단 후 수동 복구 proof는 보류다.

## 2026-10-17 host installer 누락 보완

#149~#152 병합 후 main `5a8e31c32e636d2179c32b6aef9ac183777309e5`에서 후속 수정했다.
위 installer 설명과 달리 설치 목록에 `paired-release.py`가 빠져 있어 신규 설치 후 preflight와
배포 진입점의 필수 파일 검사가 실패할 수 있었다. `300f73f97d096f738f64850d4c75bd691d986de7`은
기존 목록에 helper를 추가하며, 설치 경로·0755 권한·보호 설정 보존·명시적 upgrade 계약은 유지한다.

회귀 테스트는 수정 전 helper 누락(ENOENT)으로 실패했고 수정 후 성공했다. 임시 경로에서 실제
installer의 `install`/`flock`을 실행해 여섯 스크립트의 내용·0755 권한, 재설치 시 stale helper 교체,
기존 설정 세 파일의 값·0600 권한 보존을 확인했다. root 검사는 fixture에서 우회하고
sudoers 검증·systemd 호출은 대체했다. 실제 root 소유권·legacy host upgrade의 실증은 아니다.

기본 여섯 검사(harness 18건·unit 459건)와 두 앱 `pnpm build`(캐시 0), `bash -n`,
`git diff --check`가 성공했다. ops 최초 실행은 앱 검사/build와 동시 실행 중 기존 Python fixture의
10초 timeout 두 건으로 실패했다. 코드·timeout 변경 없이 단독 재실행한 `pnpm test:ops`는 155건 모두 성공했다.
commit hook ESLint/Prettier·commitlint도 성공했다. 후속 PR과 원격 CI 결과는 PR 본문에서 추적한다.

실제 VM 설치/배포·OCI/Vault·Terraform·Secret/DB 변경은 실행하지 않았다.
OCI 인증 전 배포 차단과 #142 OPEN을 유지하며, 실제 첫 paired 전환·공동 복구·두 앱 IMDS 검증은 남아 있다.
