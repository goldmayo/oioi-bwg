---
title: "P06-B2-2 앱별 runtime env 생성 구현 결과"
kind: migration-result
status: active
source_commit: 1249e6b36e9e4d748affb0db92e91692becc4016
verified_at: "2026-10-16"
---

# P06-B2-2 결과

[P06 계획](https://github.com/goldmayo/oioi-bwg/blob/e93ae610169e4ce0e9b7f1a75a9a02cbf179d46f/docs/migration/implementation/console-guide-editor/P06-PLAN.md) §4/5의 다음 checkpoint다. #148 병합
`18de205ad1b187101922228dfe83678f927238d7`에서 `feature/p06b2-runtime-env`를 분기했다.
기존 Web의 env 생성을 `materialize-runtime-env.py`로 연결하고 Console 임시 env 검증을 준비했다.
installer/preflight에 helper를 포함했지만 실제 host에서는 실행하지 않았다. PR/원격 CI는 PR 본문에서 추적한다.

public/Secret mapping을 앱별로 구분하고 중복·누락·다른 앱 키·공개 파일의 Secret·잘못된 OCI 내용·
줄바꿈/NUL을 거절한다. Console은 loopback HTTP origin, 자체 Auth 최소 32자, canonical Base64
32-byte MFA key와 Auth/MFA 값 불일치를 확인한다. DB URL은 기존 non-owner role/password로 조립하며
Secret 원문/CLI 오류를 출력하지 않는다. 검증 후에만 caller의 임시 파일을 0600으로 쓰고 raw 값을 보존한다.
Console 예시는 새 설정 검토용이며 installer가 기존 설정을 덮어쓰거나 Console 설정을 자동 생성하지 않는다.

직접 기본 여섯 검사, ops 120건, 두 앱 build가 성공했다. harness 18건·unit 459건·unit/build 캐시 0이며
harness 종료 후 lint를 실행했다. Python 3.12.3의 CLI fixture 21개 시나리오와 기존 Web 성공/복구 회귀,
env 오류 때 Docker 미호출·기존 env/current 보존을 확인했다. Python/Vault는 fake OCI이며 실제 읽기가 아니다.
`bash -n`으로 변경한 세 shell script를 검사했고 commit hook ESLint/Prettier·commitlint도 성공했다.

**배포 workflow 차단·기존 단일 Web host 계약은 유지한다. 실제 설치·배포·Secret/DB/개인 env 변경은 없다.**
다음은 두 임시 env의 동시 preflight·앱 간 Secret 값 비교·pair state/snapshot·apply/rollback,
기존 `app`의 최초 전환 실패 시 Web 복구/Console 중지와 명시적 host upgrade다. 이번 per-app helper를
두 앱의 원자적 배포/복구 완료로 보고하지 않는다. #142는 OPEN이며 병합하지 않는다.
