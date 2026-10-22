---
title: "기존 Console 환경변수 작업 회수 결과"
kind: migration-result
status: partial
source_commit: aa4e814f9fdbfd1c69b8b3af8934e5c99b80277c
created_at: "2026-10-23"
---

# 기존 환경변수 작업 회수

이번 변경은 새 정상화 기능 구현이 아니라 기존 미커밋 작업의 검토·회수다.
[환경 구성 계획](ENVIRONMENT-CONFIGURATION-PLAN.md)의 ENV-1과
[모노레포 재개 계획 고정본](https://github.com/goldmayo/oioi-bwg/blob/103b89466926d86628d6a80b4abce03333e3844f/docs/migration/implementation/MONOREPO-CONFIGURATION-PLAN.md)의
ENV/OBS/MAIN 범위를 대조했다. 기준은 헌법 §5, Runtime §11~14, 배포 runbook §21이다.

## 원본과 보존

- 원본: `/home/hsj95/.codex/worktrees/p06-web-public-only/cheer-rock-crab`,
  `feature/p06-console-env-boundary@4d5e42dac37aeb13b3279b47a7907fbb7bc91be2`의 미커밋 16파일.
- 저장소 밖 보존: `/home/hsj95/.codex/recovery/monorepo-20261023-0b6s5a9k/A-env/`.
  full-index patch·변경 파일 snapshot·경로별 SHA-256·원본 ref를 보존했다.
  snapshot 전후 해시가 같았고 원본을 수정하지 않았다. 개인 env는 제외하고 알려진 private secret/token/key 패턴을 검사했다.
- 회수: 최신 원격 main `aa4e814`에서 만든 `feature/recover-console-env-boundary`,
  `.local/worktrees/recovery-console-env`. 원본 commit·index·개인 env·DB volume·MFA 키를 보존한다.

## 회수한 범위와 보정

- Console 예제에 R2 다섯 입력과 명시적 Sentry 입력을 추가하고 Web의 종료된 인증·메일·업로드 예제를 정리했다.
  Web DB 예제를 추가했다. 실제 개인 env를 변경하지 않았다.
- 기존 local launcher에 R2 누락·HTTPS URL 형식 검사를 회수했다. 고정 local migration URL과
  Web env에 결합된 DB guard는 바꾸지 않았다. DB-01/02와 ENV-2의 전체 credential 전환은 미구현이다.
- 기존 host materializer에 Console R2 공개 입력·Vault 매핑 필수 검사를 회수하고 예제·fixture를 맞췄다.
  누락 시 Vault 호출과 임시 env 덮어쓰기 전 거절한다. 운영 파일 설치나 Vault 조회는 실행하지 않았다.
- 원안의 **Sentry 프로젝트 필수 분리**는 모노레포 PLAN OBS-01의 공용 프로젝트 유지 계약과 충돌한다.
  원안의 CI·promotion hash·관련 두 테스트 파일 변경은 제외하고 문서·예제를 공용 프로젝트에 맞췄다.
  제외한 원안은 위 snapshot에 그대로 있다. 새 프로젝트·DSN·GitHub 변수 생성을 요구하지 않는다.
- Console readiness의 R2 검사는 원안에 없으며 이번 회수에서 새로 만들지 않았다.
  APP_ENV/metadata 통일·Docker·release-it·shadcn·UI/Worker 패키지화도 미구현이다.

## 검증과 한계

검사 기준은 위 회수본의 코드다. 이전 실행과 이번 실행을 구분하며 완료 수치는 아래에 추가한다.
외부 R2 업로드·실제 Vault 주입·Sentry 전송/업로드·운영 배포·관리자 전체 E2E는 실행하지 않았다.
Draft PR 연결만으로 모노레포 체크리스트의 구현/운영 항목을 완료 처리하지 않는다.

## 다른 작업과의 관계

원안은 모노레포의 `tests/ops/deploy-via-run-command.test.ts`, F의 `.github/workflows/verify.yml`과
겹쳤다. 필수 Sentry 분리를 제외한 회수본의 코드 경로는 현재 모노레포·Sentry 앱·Worker·F 준비 변경과 겹치지 않는다.
모노레포의 공통 Sentry build 옵션은 그대로 사용한다. 앱별 env는 각 앱이 소유하고 공용 config로 옮기지 않는다.
향후 병합 시 모노레포의 repo TS 검사·ops 수집과 이 launcher/materializer의 필수 R2 계약을 함께 검증해야 한다.
F의 production/www 전환은 별도 보류 상태이며 이 PR의 선행 작업이 아니다.

### 이번 실행 결과

- 각 검토 worktree에서 `pnpm install --offline --frozen-lockfile --ignore-scripts` 성공.
  최초 launcher는 pnpm PATH 누락으로 실행되지 않았고 기존 Node/pnpm 경로를 명시해 재실행했다.
- `pnpm exec turbo run type-check lint test --concurrency=2`: 12 task 성공, 캐시 0개.
  unit은 81파일·410건이다. repo 타입/lint·harness 18건·FSD·format도 성공했다.
- `pnpm test:ops`: 21파일·269건 성공. R2/Vault/배포 경계는 fixture/mock이며 외부 호출 성공 증거가 아니다.
- `pnpm build --force --env-mode=loose --concurrency=1`: 두 앱 실제 build 성공, 캐시 0개.
  임시 local 입력·빈 DSN·업로드/telemetry OFF·접속 불가능한 loopback DB와 임시 Console 키를 사용했다.
- 검증 로그와 명령별 종료 코드는 저장소 밖 `/tmp/oioi-monorepo-recovery-20261023-0b6s5a9k/validation-env/`에 보존한다.
  commit/push hook 결과는 PR 본문에 별도 기록하며 위 직접 실행 결과에 합산하지 않는다.
