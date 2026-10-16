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
