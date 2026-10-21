---
title: "CI 지연 실측과 배포 입력 검증 병목 수정"
kind: migration-evidence
status: active
source_commit: f101af46e606ebd48af0a20b5ef89cad0a0bfaa2
implementation_commit: f33492b7a28632cae726a797ca5d7b8b56e6fb37
observed_at: "2026-10-21"
---

# CI 지연 실측과 배포 입력 검증 병목 수정

기존 [빌드 재사용 결과](RESULT.md)의 2026-10-10 측정은 당시 사실로 유지한다.
이번 조사는 로그인 UX PR #177을 포함한 최근 실행과 위 source의 workflow·hook·테스트를 대조했다.
[Testing](../../oioi-bwg-architecture-clean-v1/10-testing-architecture.md)과
[배포 runbook §21](../../oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md)을 따른다.
이 문서의 후속 개선 후보는 현재 검증 정책을 변경하는 승인이 아니다.

## 실제 소요 시간

아래 전체 시간은 run 생성부터 완료 상태 갱신까지다. 병렬 job 시간을 합산하지 않는다.

| 실행 | 전체 시간 | 주요 직렬 구간 |
| --- | --- | --- |
| [#173 Verify](https://github.com/goldmayo/oioi-bwg/actions/runs/39541325093) | 8분 3초 | app build 245초 → 관리자 통합 222초 |
| [#174 파일 변경 없는 이력 연결](https://github.com/goldmayo/oioi-bwg/actions/runs/39542556758) | 8분 58초 | app build 269초 → 관리자 통합 248초 |
| [#175 Promotion Verify](https://github.com/goldmayo/oioi-bwg/actions/runs/39543479896) | 15분 30초 | app build 255초 → 관리자 통합 233초 → verify → ARM64 후보 413초 |
| [#175 실제 배포](https://github.com/goldmayo/oioi-bwg/actions/runs/39545543065) | 4분 25초 | Run Command 인증 31초·배포 210초 |
| [#177 Verify](https://github.com/goldmayo/oioi-bwg/actions/runs/39550228103) | 첫 실행 8분 45초 실패, 재실행 구간 4분 15초 | 기존 배포 fixture 180초 초과. unit과 후속 gate만 재실행하여 성공 |

#174 → #175 검증 → 실제 배포만 합쳐도 약 28분 53초다. 사람의 리뷰·승인 대기와 앞선 기능 PR 검증은 포함하지 않는다.
#167의 run 39533783736은 attempt 2가 있으므로 최초 생성과 마지막 시작 시각 차이를 runner 대기 시간으로 해석하지 않는다.

## 확인한 원인

### 배포 입력 정규식과 반복 실행

`deploy-release.sh`와 `deploy-via-run-command.sh`는 Bash에서
`^[A-Za-z0-9_-]{1,16000}$`를 매 실행 평가했다. 로컬 Bash 추적에서 이 한 줄에 3.2~4.6초가 걸렸다.
가짜 배포의 `test_no_changes` 한 건은 9.2초였지만, 두 번 실행된 Python 배포 로직의
프로파일 시간은 각각 0.35·0.44초였다. 두 배포 진입점의 큰 반복 범위 검사가 주요 병목이다.

[이전 #167의 첫 실행](https://github.com/goldmayo/oioi-bwg/actions/runs/39533783736/attempts/1)과
[#177 첫 실행](https://github.com/goldmayo/oioi-bwg/actions/runs/39550228103/attempts/1)이
같은 Python fixture의 180초 제한으로 실패했다. #177 재실행은 fixture 154.8초,
OCI 전송 테스트 45.4초, 전체 ops 162.2초로 통과했다. 업무 단위 테스트 실패와 구분한다.

로컬에서도 `pnpm verify` 뒤 pre-push가 root 검증과 ops를 다시 실행한다.
이번 수정 전 ops 실측은 verify 158.49초, push hook 155.47초였다.
package 단위 Turbo cache와 달리 root ops/harness에는 검증 결과 재사용이 없다.

### 서로 다른 PR에서 빌드 캐시 미스

#173·#174·#175의 검증용 cache key는 같은 `Linux-verify-amd64-v2-0109ae…`였다.
세 app build 로그 모두 `Cache not found`이며 cache API에는 각각
`refs/pull/173/merge`, `refs/pull/174/merge`, `refs/pull/175/merge`에 약 1.30GB가 저장돼 있었다.

[GitHub cache 규칙](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#restrictions-for-accessing-a-cache)상
PR merge ref의 캐시는 다른 PR이나 base branch가 복원할 수 없다.
현재 push trigger는 main/develop뿐이고, 실제 통합 기준인 migration_main에는 캐시 생성 실행이 없다.
같은 PR 재실행 최적화만으로 새 PR의 빌드 비용은 해결되지 않는다.
Docker `COPY . .`에는 테스트·운영 스크립트도 들어가며 일반 검증 builder는 두 앱을 빌드한다.

### 빌드 이후 관리자 통합과 실제 OTP 시간 대기

관리자 job은 app_build 종료 후 시작한다. #175에서 233초 중 실제 관리자 시나리오가 156초였다.
`console-mfa-smoke.mjs`의 `nextConsoleOtp`와 `console-enrollment-smoke.mjs`의 `nextOtp`는
같은 테스트 계정의 사용된 time step 때문에 실제 30초 구간이 진행될 때까지 기다린다.
로그에서 등록 검증 구간은 약 56초, 관리 편집 이후 세션·권한 경계 구간은 약 76초였다.
각 구간에는 다른 검증도 포함되므로 이 시간을 전부 OTP 대기로 단정하지 않는다.
이는 자동화 fixture 재사용의 비용이며, 실제 사용자가 새 코드가 뜨자마자 로그인해야 한다는 뜻이 아니다.

### 배포 후보의 불필요한 빌더 삭제

#175 후보의 Web ARM64 빌드는 149초, Console은 44초였다.
검증과 후보 기록 후 `docker buildx rm`에 추가 83초가 걸렸다.
일반 app_build는 이미 `cleanup: false`지만 promotion-candidate에는 없다.
[Buildx action](https://github.com/docker/setup-buildx-action#inputs)은 cleanup을 기본 활성화한다.
GitHub-hosted 일회성 VM의 해당 정리 비용은 별도 개선할 수 있다.

### 작은 중복과 변경 범위

Terraform 검증은 infra와 PostgreSQL job 양쪽에서 실행된다. #175 기준 각각 약 8초다.
앱 `lint`는 FSD를 포함하지만 quality에서 FSD를 한 번 더 실행한다.
이 중복은 낭비지만, 병렬인 quality/DB job만 줄여서는 app_build → 관리자 통합의 완료 시간이 크게 줄지 않는다.
일반 PR 분류는 Markdown-only 여부만 구분하므로 작은 코드 수정·빈 diff 이력 연결도 전체 검증이다.
Promotion의 full verify와 source/merge tree·digest 검증은 현재 runbook의 명시적 계약이다.

## 이번 수정 범위와 검증

두 Bash 진입점에서 길이를 먼저 확인하고 `^[A-Za-z0-9_-]+$`로 문자를 확인한다.
1~16,000자의 base64url 문자 제한, 후보 JSON/동일 digest 검증, 실패 코드와 실제 배포 절차는 유지한다.
Python의 별도 검증은 그대로 둔다. 배포 테스트 timeout을 늘리지 않는다.

두 실제 진입점에 빈 값·1자·허용 문자·16,000자·16,001자·padding·공백·개행·쉘 구두점·비 ASCII 입력
20건을 추가했다. 성공 문자열은 다음 guard에서 멈추므로 실제 OCI나 호스트 설정을 사용하지 않는다.
기존 paired host/OCI transport 회귀와 합친 45건은 9.46초에 통과했다.

Bash 검사 단독 실측: 기존 1,300자 입력 3,898ms → 변경 후 1.23ms.
기존 16,000자 측정은 15초 제한으로 종료했으며, 변경 후에는 1.98ms에 허용됐다.
새 검사에서 빈 값·길이 초과·개행·padding 거부도 확인했다. 수치는 이 로컬 환경의 표본이다.

`pnpm verify`가 통과했다. root 타입·ESLint, 구조 harness 18건, ops 231건, format을 실행했다.
package 타입·린트·단위 487건에 대응하는 Turbo 12 task와 두 앱 build는 동일 입력의 로컬 cache를 재사용했다.
전체 ops는 22.30초로 수정 전 158.49초보다 약 86% 줄었다. 새 테스트 20건도 포함한다.
`bash -n` 두 스크립트와 `git diff --check`도 통과했다.
GitHub의 수정 후 실측과 자동 push hook 결과는 해당 PR에서 이어서 기록한다.
VM에 설치된 운영 스크립트는 이 로컬 변경만으로 갱신되지 않는다.

## 사용자 결정 — 관리자 전체 E2E 자동 실행 제외

2026-10-21 사용자의 명시적 요청으로 `Admin migration integration` job을 Verify workflow에서 제거하고
required gate의 needs·검증 목록도 함께 갱신했다. 일반 PR·기존 push·Promotion 모두 자동 실행하지 않는다.
테스트 코드와 `pnpm test:integration:admin:local` 명령은 필요 시 직접 실행할 수 있도록 남겼다.
Testing §12.1 및 배포 runbook §21을 같은 변경에서 갱신했다.
컨테이너 시작·native/readiness·간단한 화면 smoke와 Promotion의 exact digest 검증은 기존대로다.

#175 실측에서는 app_build 뒤 관리자 job 233초와 build smoke 188초가 병렬이었다.
따라서 관리자 job 제거만으로 전체 시간이 233초 줄어드는 것이 아니라 이 표본 기준 약 45초가 줄어드는 구조다.
브라우저 job 자체의 실행 비용·OTP 대기·해당 job의 실패 후 재실행 비용은 제거된다.
수정 후 실제 CI 전체 시간은 새 실행 결과로 확인한다.

## 후속 개선 순서

1. 이번 정규식 수정으로 ops 지연과 반복 timeout을 제거한다. 전체 CI의 최장 경로는 별도로 측정한다.
2. 검증을 통과한 통합 기준의 캐시를 새 PR에서 읽을 수 있도록 캐시 발행 경로를 설계한다.
   migration_main push에서 무거운 검증·빌드를 반복하지 않는 기존 계약을 고려하고,
   검증된 입력·산출물 근거를 확인하는 방식과 필요 시 runbook 개정을 별도 PR에서 다룬다.
3. 관리자 E2E는 자동 CI에서 제외됐다. 시나리오별 계정 격리는 수동 E2E가 필요할 때 검토할 별도 항목이다.
4. 일회성 ARM64 runner의 builder 정리와 중복 Terraform/FSD 실행을 정리한다.
5. squash Promotion의 이력 연결 반복을 줄이는 merge 전략은 repository 보호 설정·runbook과 함께 별도 검토한다.
   파일 변경 없는 PR의 전체 검증을 현재 규칙 아래에서 임의로 생략하지 않는다.

이 항목들의 단축 효과를 합산해 목표 시간으로 제시하지 않는다. 각 변경 후 최장 직렬 경로와
cold cache·다른 PR·동일 PR 재실행을 구분해 측정해야 한다.
