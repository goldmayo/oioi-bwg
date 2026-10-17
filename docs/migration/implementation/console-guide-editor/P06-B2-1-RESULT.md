---
title: "P06-B2-1 두 digest 명령 전달 구현 결과"
kind: migration-result
status: active
source_commit: 3b455111f64ada901bbd27c5cd794d745599ec3d
verified_at: "2026-10-15"
updated_at: "2026-10-16"
---

# P06-B2-1 결과

[P06 계획](P06-PLAN.md) §4/5의 B2를 독립 검증 가능한 checkpoint로 나눴다.
#147 병합 `f31471bceb0c04d18382f05b50ee0fa11a6b6b08`에서 `feature/p06b2-paired-transport`를 분기했다.
이번 범위는 CI→Run Command의 두 digest 입력·전달·로그 보호다. PR 번호·push hook·원격 CI는 PR 본문에서 추적한다.

adapter는 Web·Console 순서의 정확히 두 immutable digest만 받고 잘못된 인자는 OCI 전에 거절한다.
검증한 pair를 명령 본문으로 전달하고 같은 command ID/instance의 지연 조회·전체 deadline을 유지한다.
두 앱 비밀이 섞일 수 있는 OCI 오류·agent message/text는 로그에 출력하지 않는다.
보호된 임시 파일은 실패 경로에서도 삭제하며 lifecycle·정수 exit·고정 진단만 기록한다.
0/20/21은 보존하고 잘못된 exit와 실패/취소/시간 초과의 0, 취소/시간 초과의 20은 성공으로 보고하지 않는다.

직접 기본 여섯 검사와 `pnpm test:ops` 118건, `pnpm build` 두 앱이 성공했다.
harness 18건·unit 459건·unit/build 캐시 0이며 harness 이후 lint를 실행했다.
새 21건은 실제 Bash·jq와 fake OCI로 입력 거절·대상/pair/명령 ID·지연 조회·exit·원문 비노출·
모든 경로의 임시 파일 정리를 확인한다. jq 1.8.2 ARM64 공식 파일/checksum을 대조하고 임시 PATH에서 사용했다.
`bash -n`과 actionlint 1.7.12(`-shellcheck=`)의 변경 workflow 검사, commit hook ESLint/Prettier·commitlint도 성공했다.

**실제 Run Command·host 설치·배포·DB 변경은 실행하지 않았다.** workflow의 B1 차단은 그대로다.
host `deploy-release.sh`는 아직 단일 digest 계약이며 두 인자를 보내면 거절한다.
다음 B2 checkpoint는 두 env/state·apply/rollback, `app → web` 최초 전환의 기존 Web 복구/Console 중지,
installer/preflight의 명시적 upgrade와 실제 두 앱 Metadata 차단이다. 별도 승인 없이 활성화하지 않는다.
최소 권한 재설계·운영 APP_ENV 전환·P06-C 이후 공개 경계도 보류한다.

## 2026-10-16 병합과 다음 checkpoint

사용자 지시로 #148 최신 head/전체 CI 성공을 확인하고 `18de205ad1b187101922228dfe83678f927238d7`에
squash 병합했다. 새 source의 Verify `38758478070`도 일반 verify·두 ARM64 candidate·promotion 전체 성공이다.
실제 Run Command/host 배포는 없다. env 생성·검증의 후속 구현은 [B2-2 결과](P06-B2-2-RESULT.md)가 소유한다.
