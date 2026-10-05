---
title: "Console·다중 응원법·파형 편집기 구현 순서"
kind: migration-plan
status: draft
authority: plan
source_commit: a8d157960adea83c26d692709a0ad45b71884c88
created_at: "2026-10-05"
updated_at: "2026-10-05"
revision: 6
---

# 구현 순서와 PR 단위

[설계](DESIGN.md)를 구현하는 **10개 checkpoint**다. 전체 방향 승인 후 runtime/검증 구조 수정 지시를 반영했다.
Console 배포를 P06으로 앞당긴 독립 기능 작업선을 유지하고, 이번 개정은 P08의 enqueue 응답 불확실성 완료 조건만 보완한다.
아직 구현하지 않았으며 이 문서 PR에 앱·DB·인증·runner/worker 코드는 포함하지 않는다.

## 1. 코드 의존성과 운영 순서

```text
Console 전환 작업선
P01 앱 이동 → P02 Turbo/config/harness → P03 실제 공통 코드 추출
  → P04 Console 이관 → P05 TOTP → P06 두 앱 배포·Web Admin 종료

Console 전환 뒤의 기능 작업선
  ├─ P07 CheerGuide 세 종류 / 사용자 선택
  └─ P08 Waveform Job / OCI Queue / VM runner / SSE
       → P09 JSON 파형·Cue timeline → P10 수동 Grid/Snap/Nudge/Loop
```

**P06은 P07~P10을 기다리지 않는다.** 기존 가사 편집 기능과 MFA만으로 Console 전환을 완료할 수 있다.
위 기능 작업선은 운영상 권장 순서다. P07의 도메인 모델은 기존 Song/공유 코드에 의존하며 MFA 모델에 의존하지 않는다.
관리 API는 공통 Console guard를 재사용한다. P08은 CheerGuide 없이 기존 Song으로 구현할 수 있고,
P09~P10도 기존 가사 JSON을 입력으로 사용한다. BPM/beatOffset은 Song의 편집 설정으로 저장한다.
따라서 타입 추가와 파형 기능을 서로의 출시 선행 조건으로 묶지 않는다.

헌법·영역 architecture·Domain 변경은 해당 checkpoint의 규칙만 함께 반영한다.
기존 Server/FSD/API의 전면 개편이나 Queue/Notification framework를 이 전환의 선행 작업으로 만들지 않는다.

## 2. 실제 PR 단위

| ID / PR 제목                                                | 범위·DB/API/UI 변화                                                                                                                                                                  | 코드 선행 / 운영 순서                                 | 완료 조건                                                                                                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P01 `refactor(workspace): 기존 앱을 웹 워크스페이스로 이동` | 기존 Next 앱을 apps/web로 이동. workspace·경로·단일 앱 Docker/CI 진입점만 보정. DB/API/UI 동일.                                                                                      | 현재 기준                                             | /admin 포함 기존 URL·asset·standalone image·검증 명령 동작 보존.                                                                                                                      |
| P02 `chore(config): 공용 설정과 검증 기반 분리`             | config/typescript·config/eslint, harness/architecture의 공통 primitive·repo 경계, workspace별 정책·독립 FSD root, Turbo/root verify/Husky.                                           | P01                                                   | workspace별 검사 정책이 분리됨. source/shared config/harness/policy/env 변경 시 필요한 검사 재실행, cache hit·전체 verify 확인.                                                       |
| P03 `refactor(workspace): 공통 계약과 서버 코드 추출`       | 실제 contracts/server·migration 경로 추출. React/Next request/session/HTTP adapter는 앱에 유지. 외부 계약 동일.                                                                      | P02                                                   | contracts 순수성·server-only·repository/service 방향·앱 간 의존 금지, 소비 앱 type-check/build 성공.                                                                                  |
| P04 `feat(console): 운영 화면과 API 이관`                   | Console entry·기존 Admin UI/API/업로드 Action 이관. Web 경로 임시 유지.                                                                                                              | P03                                                   | 접근 제한 환경에서 두 경로의 기존 작업 완주. 독립 build, direct import 없음.                                                                                                          |
| P05 `feat(auth): 콘솔에 간단한 TOTP 인증 적용`              | admin_mfa migration·Auth.js+otplib·등록 UI·limiter·Origin/CSRF·CLI reset·관리 guard. Auth/Domain 회수 규칙 반영.                                                                     | P04                                                   | password-only/비ADMIN/미등록/다른 앱 cookie 거절. replay·동시성·version 회수·제한된 재등록 검증.                                                                                      |
| P06 `feat(deploy): 두 앱 배포와 기존 관리 경로 종료`        | 두 image·기존 CD/Compose/Caddy/env/health/rollback 보정, staging 확인 후 Web 관리 route/API/Action 제거.                                                                             | P04/P05. Audio/Guide 불필요.                          | 기존 가사 편집만으로 Console 공개. 두 hostname·전용 cookie·인가·pool·복구 smoke, www 관리 직접 호출 실패.                                                                             |
| P07 `feat(guide): 세 종류 응원법과 선택 화면 추가`          | 최소 CheerGuide migration·기존 가사 JSON/쓰기·수동 분류·조회·segmented/nuqs. Domain의 FAN 분리·초기 이력 적용 범위 반영.                                                             | 모델 P03, 관리 화면 P04의 공통 guard. 운영상 P06 후.  | 0/1/2~3개·우선순위·URL/재생 유지, 미분류/내용 보존, LRC/삭제 경로·동시 저장 충돌 검증.                                                                                                |
| P08 `feat(waveform): 큐 기반 일회성 파형 작업 추가`         | WaveformJob/결과 migration·active Job 재사용·202/status API·OCI Queue/DLQ·Runner Instance Principal/Unix socket·worker·내부 결과 API·EventEmitter/SSE. Domain source/lifecycle 반영. | P03/P04 및 관리 guard P05. 운영상 P06 후, P07 불필요. | 동시 생성/재전달·visibility 연장·저장 전 delete 금지·DLQ→FAILED·enqueue/DB 경계·IAM/socket/metadata 제한·SSE 재연결/알림 실패 검증. ARM64/비영속성 및 3개 anchor의 offset/drift 검증. |
| P09 `feat(editor): 파형과 큐 타임라인 편집 제공`            | Peaks.js·YouTube adapter·overview/zoom/playhead·point drag·RHF draft/history.                                                                                                        | P04/P08, 기존 가사 JSON 사용 가능.                    | JSON만으로 표시·재생/seek 동기화·1회 Undo/취소·기존 캡처/LRC/강조 보존. 누적 drift 미해결이면 integration 완료로 처리하지 않음.                                                       |
| P10 `feat(editor): 박자 격자와 이동 반복 도구 추가`         | Song의 BPM/beatOffset 편집 설정 JSON·Grid/Snap·Nudge/Fine Nudge·Cue/A-B Loop·focus/IME 단축키.                                                                                       | P09, P07 불필요.                                      | 120 BPM 수식·Snap ON/OFF·기존 Cue 불변·경계/Undo 검증, 같은 작업의 소요 시간·오차 확인.                                                                                               |

한 행은 독립 검증 가능한 concern/checkpoint다. 앱 이동은 rename 비중 때문에 파일 수 기준을 넘을 수 있다.
이 경우 이동→경로 보정→동작 검증 순서를 PR에 적는다. 실제 diff가 20파일/400줄 목표를 크게 넘으면
해당 checkpoint 안에서 준비/계약/구현으로 나누며 빈 패키지나 범용 플랫폼 PR을 선생성하지 않는다.

## 3. 검증과 전환 조건

- P02 전에는 기존 type-check/harness/lint/FSD/unit/format과 필요한 build를 실행한다. 이후 root `pnpm verify`가 workspace별 검사·독립 앱 Steiger·repo 경계 harness·운영 테스트·format·두 앱 build를 실행한다.
- schema 수정 → Drizzle migration 생성 → SQL 검토 → guarded local 적용 → 검증 순서를 지킨다. MFA replay·job 상태/멱등성·동시 저장은 local Docker PostgreSQL에서 확인하고 production 적용은 별도 실행 범위로 둔다.
- UI는 바뀐 selector·로그인·editor/SSE 연결 흐름을 Playwright로 확인한다. root config/harness 변경이 affected 검증에서 빠지거나 다른 workspace 정책을 섞지 않는지도 확인한다.
- P08은 실제 OCI Queue staging에서 long poll·재전달·visibility 연장·DLQ·runner/VM 재시작·결과 commit 후 ack 실패를 확인한다. mock만으로 완료하지 않는다.
- P08에서 연속 클릭·응답 유실 후 재요청·동시 POST가 동일 songId/videoId의 active Job 한 개를 재사용하고 새 message를 추가하지 않는지 검증한다. DB 원자성 수단은 구현 시 선택하고 terminal 이후 재생성은 허용한다.
- Runner의 Instance Principal과 Queue push/pull 범위, Console의 제한된 Unix socket 호출, Console/Web/worker의 metadata 차단을 staging에서 확인한다. 같은 VM의 IAM을 process별 권한 분리로 간주하지 않는다.
- Worker의 성공/실패/timeout/강제 종료 후 host/container/volume/log/Sentry에 음원·PCM이 남지 않아야 한다. 같은 videoId의 3개 이상 anchor로 일정 offset과 누적 drift를 구분하며 기준·측정값을 기록한다.
- SSE는 단일 Console process의 DB commit → EventEmitter → stream으로 연결한다. 이벤트 누락/중복·재연결·서버 재시작·listener 오류 후에도 DB를 Query로 다시 읽으면 같은 job/결과를 보아야 한다. LISTEN/NOTIFY는 Console process/container가 둘 이상일 때 후속으로 검토한다.
- 문서 작업은 내용·링크·format만 검사한다. push hook 검증은 hook 실행 결과로 별도 보고한다.

P08의 필수 enqueue 응답 유실 검증은 다음 순서로 수행한다.

1. DB Job 생성에 성공한다.
2. Runner의 OCI Queue PutMessages에 성공한다.
3. Unix socket 성공 응답만 의도적으로 유실시킨다.
4. Console이 socket 실패를 이유로 기존 Job을 즉시 FAILED로 전환하지 않는지 확인한다.
5. Queue message가 Runner에 전달되는지 확인한다.
6. 같은 jobId가 RUNNING → SUCCEEDED로 정상 수렴하는지 확인한다.
7. 전체 시나리오에서 추가 Job/중복 Queue message가 생성되지 않았는지 확인한다.

Runner의 내부 API 기록 후 socket 응답만 유실된 경우와, 기록도 못 해 enqueuedAt이 null인 채 consume되는 경우를 확인한다.
반대로 PutMessages 실패와 message 미생성이 확정된 경우에는 FAILED로 수렴해야 한다.
미확인 QUEUED의 stale 기한은 가장 늦은 enqueue 가능 시점부터 실제 Queue 최대 message retention과 충분한 안전 여유를 포함해 보수적으로 정한다.
기한 이전에는 enqueue 불확실성만으로 FAILED 처리하지 않고 정상 지연 전달을 허용하는지 검증한다.
그 이후에만 기존 stale-job 점검으로 정리하며, 늦은 전달 확인/consume과 경합해 진행된 상태를 역전하지 않아야 한다.
이 검증에 Outbox/DB queue/retry scheduler/분산 transaction/범용 reconciliation·broker abstraction을 추가하지 않는다.

P06 전환 순서는 **두 image/routing 준비 → 비공개 Console smoke/MFA 등록 → Web 관리 경로 제거 → 두 앱 배포 검증 → Console 공개**다.
P04/P05의 기존 기능과 인가 확인 전에는 기존 경로를 지우지 않는다. rollback도 password-only 관리 경로를 다시 공개하지 않는다.
Guide writer 전환 뒤 rollback은 새 guide를 읽는 호환 앱으로 제한하고 Song.lyrics의 파괴적 정리는 후속으로 둔다.

각 PR은 repository template과 한글 Conventional Commit → push → PR 절차를 따른다.
후속 보류는 Revision 이력/승인, 공연별 다수 variant, DB role hardening, 닫힌 탭/서비스 전체 Web Push다.
자동 BPM/Alignment/GPU/ML, 자체 Queue/Notification framework는 로드맵에 넣지 않는다.
