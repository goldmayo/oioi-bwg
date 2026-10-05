---
title: "Console·다중 응원법·파형 편집기 구현 순서"
kind: migration-plan
status: draft
authority: plan
source_commit: a8d157960adea83c26d692709a0ad45b71884c88
created_at: "2026-10-05"
updated_at: "2026-10-05"
revision: 2
---

# 구현 순서와 PR 단위

[최소 설계](DESIGN.md)를 구현하는 **10개 checkpoint**다. 최초 설계의 35개 PR 계획을 대체한다.
아직 구현하지 않았으며 이 문서 PR에 앱·DB·인증·worker 코드는 포함하지 않는다.

## 1. 실행 순서

```text
P01 앱 경로 이동 → P02 Turbo/tooling 고정 → P03 실제 공통 코드 추출
  → P04 Console 이관 → P05 TOTP → P06 다중 응원법
  → P07 one-shot 파형 생성 → P08 파형·Cue timeline
  → P09 수동 Grid/Snap/Nudge/Loop → P10 두 앱 배포·Web Admin 종료
```

앱 분리는 코드 이동부터 시작한다. 기존 `/admin`은 이관 확인까지 보존하고 Console은 전환 전 접근을 제한한다.
헌법·영역 architecture·Domain 변경은 해당 checkpoint에 필요한 규칙만 함께 반영한다.
정책 개정을 별도 여섯 단계로 늘리거나 기존 Server/FSD/API를 전면 재설계하지 않는다.

## 2. 실제 PR 단위

| ID / PR 제목                                                | 범위·DB/API/UI 변화                                                                                                                  | 선행                         | 완료 조건                                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| P01 `refactor(workspace): 기존 앱을 웹 워크스페이스로 이동` | 기존 Next 앱을 apps/web로 이동. workspace·경로 참조·단일 앱 Docker/CI 진입점만 보정. DB/API/UI 동작 동일.                            | 현재 기준                    | /admin 포함 기존 URL·static asset·standalone image·검증 명령 동작 보존.                                                                       |
| P02 `chore(tooling): 터보와 공통 검증 설정 도입`            | shared TS/ESLint·중앙 FSD/harness·Turbo·root verify/Husky. DB/API/UI 동일.                                                           | P01                          | pnpm verify가 기존 검사+build+format을 실행. 재실행 cache hit, source/tooling/env 변경 시 필요한 검사 재실행.                                 |
| P03 `refactor(workspace): 공통 계약과 서버 코드 추출`       | 실제 공유 계약/server 소스·migration 경로 이동. 새 DI/Repository/transport 없음. 외부 계약 동일.                                     | P02                          | client→server/app 간 import 차단, 단일 schema 이력, 소비 앱의 type-check/build 성공.                                                          |
| P04 `feat(console): 운영 화면과 API 이관`                   | Console Next entry와 기존 Admin UI/API/업로드 Action 이관. API origin 추가, 기존 Web 경로 임시 유지.                                 | P03                          | 접근 제한 환경에서 두 경로의 기존 작업 완주. Console과 web 독립 build, direct import 없음.                                                    |
| P05 `feat(auth): 콘솔에 간단한 TOTP 인증 적용`              | admin_mfa migration·Credentials+otplib·등록 UI·기본 limiter·Origin/CSRF·CLI reset·전체 관리 guard. Auth/Domain 회수 규칙 반영.       | P04                          | password-only/비ADMIN/미등록/다른 앱 cookie 거절. OTP replay·동시성·version reset 거절, 등록/분실 재등록 검증.                                |
| P06 `feat(guide): 세 종류 응원법과 선택 화면 추가`          | 최소 CheerGuide migration·기존 가사 JSON/쓰기 연결·수동 분류·공개 조회·segmented/nuqs. Domain에 FAN 분리와 초기 이력 적용 범위 명시. | P05, 수동 매핑 입력          | 0/1/2~3개·기본 우선순위·URL/재생 유지 검증. 미분류 보존, 내용 shadow 비교, 모든 LRC/삭제 경로 확인, 두 탭 저장 충돌 거절.                     |
| P07 `feat(waveform): 일회성 파형 생성 작업 추가`            | CLI/container·고정 workflow/host 실행·작은 Waveform 저장 단위·생성/상태/결과 API. Domain source 정책 반영.                           | P05/P06, 입력 이용 범위 확인 | ARM64에서 실제 pipe→JSON·callback·동시 한 작업·timeout·늦은 결과 거절 검증. 성공/실패/강제 종료 뒤 음원·cache·컨테이너 잔존 없음.             |
| P08 `feat(editor): 파형과 큐 타임라인 편집 제공`            | Peaks.js·YouTube adapter·overview/zoom/playhead·point drag·RHF draft/history 연결. 공개 API 변화 없음.                               | P07                          | JSON만으로 표시, 재생/seek 동기화, drag 취소/1회 Undo, 기존 LRC/캡처/강조 기능과 실패 시 draft 보존.                                          |
| P09 `feat(editor): 박자 격자와 이동 반복 도구 추가`         | 수동 BPM/beatOffset 설정 JSON·Grid/Snap·Nudge/Fine Nudge·Cue/A-B Loop·focus/IME 단축키.                                              | P08                          | 120 BPM 수식·Snap ON/OFF·기존 Cue 불변·경계/Undo 검증. 같은 편집 과제로 기존 대비 소요 시간·오차 확인.                                        |
| P10 `feat(deploy): 두 앱 배포와 기존 관리 경로 종료`        | web/console image·기존 CD/Compose/Caddy/env/health/rollback 보정. staging 확인 후 Web 관리 route/API/Action 제거.                    | P05~P09                      | 두 hostname·전용 cookie·인가·리소스/pool·복구 smoke. www의 관리 직접 호출 실패. 한쪽 rollback도 password-only 관리 경로를 다시 공개하지 않음. |

한 행은 독립 검증 가능한 concern/checkpoint다. 단순 앱 이동은 rename 비중 때문에 파일 수 기준을 넘을 수 있다.
그 경우 PR 본문에 이동→설정 경로→동작 보존 검증 순서를 적는다. 실제 기능 diff가 20파일/400줄 목표를 크게 넘으면
그 checkpoint 안에서 준비/계약/구현으로 나누되, 처음부터 빈 패키지·미래 기능 PR을 추가하지 않는다.

## 3. 검증과 전환 조건

- P02 전에는 기존 `type-check`, `test:harness`, `lint`, `lint:fsd`, `test:unit:run`, `format:check`와 변경에 필요한 build를 실행한다. 이후 root `pnpm verify`가 이 검사들과 운영 테스트·두 앱 build를 소유한다.
- schema 변경은 Drizzle schema 수정 → migration 생성 → SQL 검토 → guarded local 적용 → 검증 순서다. 인가·replay·동시 저장은 local Docker PostgreSQL에서도 확인한다. production 접속/적용은 이 계획의 범위가 아니다.
- UI는 변경된 selector·로그인·편집 흐름만 Playwright로 확인한다. 도구 자체를 재검증하는 중복 테스트 대신 앱의 경계·취소·저장 실패를 검증한다.
- worker는 공식 도구의 ARM64 지원과 최소 container 실행을 먼저 확인한다. 실패하면 자동 분석 플랫폼을 추가하지 않고 파형 생성 경로의 실패로 기록한다.
- 문서 작업은 내용·링크·format만 검사한다. push hook이 실행한 application 검증은 hook 결과로 별도 보고한다.

P10에서는 **두 image/routing 준비 → 비공개 Console smoke/MFA 등록 → Web 관리 경로 제거 → 두 앱 배포 검증 → Console 공개** 순서로 전환한다.
P04~P09의 이관 확인이 끝나기 전에 기존 경로를 지우지 않으며, MFA가 없는 관리 경로를 전환 결과로 공개하지 않는다.
Guide writer 전환 뒤 rollback은 새 guide를 읽는 호환 앱으로 제한하고, 기존 Song.lyrics 컬럼의 파괴적 정리는 후속으로 남긴다.

각 PR은 `.github/PULL_REQUEST_TEMPLATE.md`를 따르고 검증 후 한글 Conventional Commit → push → PR로 기록한다.
후속 보류는 Revision 이력/승인 기능, 공연별 다수 variant, DB runtime role hardening이다. 자동 BPM/Alignment/GPU/Queue 작업은 로드맵에 넣지 않는다.
