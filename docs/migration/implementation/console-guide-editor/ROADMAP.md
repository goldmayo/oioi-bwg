---
title: "Console·다중 응원법·파형 편집기 구현 순서"
kind: migration-plan
status: draft
authority: plan
source_commit: a8d157960adea83c26d692709a0ad45b71884c88
created_at: "2026-10-05"
updated_at: "2026-10-27"
revision: 22
---

# 구현 순서와 PR 단위

[설계](DESIGN.md)를 구현하는 **10개 checkpoint**다. 전체 방향 승인 후 runtime/검증 구조 수정 지시를 반영했다.
P01~P06의 완료·검증은 [완료 지도](../COMPLETED-DESIGN-INDEX.md)와 각 RESULT에 둔다.
이 문서는 기능별 범위·의존성·완료 조건을 소유한다. 현재 상태·별도 후속의 유일한 목록은 [WORK](../../../WORK.md)다.

**2026-10-26 결과 반영:** P07 구현·로컬 검증을 완료했다. 운영 적용은 별도이며 P08~P10은 미착수다.
[P06 전체 결과](P06-RESULT.md)와 [P07 결과](P07-RESULT.md)가 각 완료 근거를 소유한다.
G 계정 관리·추가 부하 실험은 독립 후속이며 P07의 선행 조건이 아니다. 현재·보류 상태는 WORK에서 관리한다.

## 1. 코드 의존성과 운영 순서

```text
Console 전환 작업선
P01 앱 이동 → P02 Turbo/config/harness → P03 실제 공통 코드 추출
  → P04 Console 이관 → P05 TOTP → P06 두 앱 배포·Web Admin 종료
  → P06 A~F 전체 종료
       └─ P06-G 계정 관리: 별도 후속 기능 / P07 선행 조건 아님

Console 전환 뒤의 기능 작업선
  ├─ P07 CONCERT/FESTIVAL · 공식/팬덤 · 데이터/조회
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
| P06 `feat(deploy): 두 앱 배포와 기존 관리 경로 종료`        | 두 image·기존 CD/Compose/Caddy/env/health/rollback 보정, preview Web을 www로 전환. Web 관리 route/API/Action·회원가입 페이지/가입 API 및 기존 Web Worker·staging 경로 종료.          | P04/P05. Audio/Guide 불필요.                          | ARM64 빌드 전 B0 IAM 실증·실제 Web/Console metadata 차단 후 Console 공개. 데이터/파일 보존, 최종 두 hostname·전용 cookie·인가·pool·복구 smoke, www 관리·가입 API 직접 호출 실패.      |
| P07 `feat(guide): 두 공연 모드의 데이터와 조회 기반 추가`          | Guide/Snapshot/Publication·공식/팬덤·수동 이관·기존 writer 호환·공개 조회/선택. 새 관리자 편집은 후속.                                                             | 모델 P03, 관리 화면 P04의 공통 guard. 운영상 P06 후.  | 0/1/2개·URL/재생·출처·visibility·내용 보존. 이관/LRC/삭제·동시성·불변성·rollback 검증 후 reader 전환.                                                                                                |
| P08 `feat(waveform): 큐 기반 일회성 파형 작업 추가`         | WaveformJob/결과 migration·active Job 재사용·202/status API·OCI Queue/DLQ·Runner Instance Principal/Unix socket·worker·내부 결과 API·EventEmitter/SSE. Domain source/lifecycle 반영. | P03/P04 및 관리 guard P05. 운영상 P06 후, P07 불필요. | 동시 생성/재전달·visibility 연장·저장 전 delete 금지·DLQ→FAILED·enqueue/DB 경계·IAM/socket/metadata 제한·SSE 재연결/알림 실패 검증. ARM64/비영속성 및 3개 anchor의 offset/drift 검증. |
| P09 `feat(editor): 파형과 큐 타임라인 편집 제공`            | Peaks.js·YouTube adapter·overview/zoom/playhead·point drag·RHF draft/history.                                                                                                        | P04/P08, 기존 가사 JSON 사용 가능.                    | JSON만으로 표시·재생/seek 동기화·1회 Undo/취소·기존 캡처/LRC/강조 보존. 누적 drift 미해결이면 integration 완료로 처리하지 않음.                                                       |
| P10 `feat(editor): 박자 격자와 이동 반복 도구 추가`         | Song의 BPM/beatOffset 편집 설정 JSON·Grid/Snap·Nudge/Fine Nudge·Cue/A-B Loop·focus/IME 단축키.                                                                                       | P09, P07 불필요.                                      | 120 BPM 수식·Snap ON/OFF·기존 Cue 불변·경계/Undo 검증, 같은 작업의 소요 시간·오차 확인.                                                                                               |

한 행은 독립 검증 가능한 concern/checkpoint다. 앱 이동은 rename 비중 때문에 파일 수 기준을 넘을 수 있다.
이 경우 이동→경로 보정→동작 검증 순서를 PR에 적는다. 실제 diff가 20파일/400줄 목표를 크게 넘으면
해당 checkpoint 안에서 준비/계약/구현으로 나누며 빈 패키지나 범용 플랫폼 PR을 선생성하지 않는다.

2026-10-26 사용자 지시로 세 종류 분류를 두 모드와 출처 속성으로 개정했다.
P07의 구현 PR은 [설계 §5.6](DESIGN.md#56-구현-pr-순서와-완료-조건)의 계약/persistence → 이관/기존 writer 호환 → 조회/선택 순서로 나눈다.
새 관리자 편집·초안/공개·복원·검토 기능은 P07 이후의 별도 관심사이며 P08~P10의 선행 조건으로 추가하지 않는다.

### 2.1. P08 착수 계획

**2026-10-27 추가:** 사용자의 P08 계획 구체화 요청을 반영한다. 기준은 fetch한
`origin/migration_main@8f371d40d1809165167a524456b990c7b0f319b9`이며, 해당 source의
`apps/console`, `packages`, `scripts`, `infra`에는 WaveformJob·worker·Queue consumer 구현이 없다.
P07은 [운영 적용·배포 결과](P07-RESULT.md#2026-10-27-최신-앱-promotion과-운영-수용-확인)로 종료됐고,
새 관리자 응원법 편집은 별도 후속이다. 위 2026-10-26 기록과 초기 `source_commit`은 당시 근거로 보존한다.
아래는 실행 전 계획이며 ARM64 분석·Queue 실증·migration·배포를 완료했다는 기록이 아니다.

#### 범위와 계약 선행

P08 산출물은 관리자 생성/상태 조회, 정상 파형 JSON, OCI Queue/DLQ, VM-local Runner,
일회성 worker와 열린 Console의 상태 알림이다. lifecycle·권한·실패 규칙은 [설계 §6](DESIGN.md#6-waveform-worker),
도구·JSON·시간축 검증은 [기술 검토](AUDIO-FEASIBILITY.md)가 소유한다.
P09 파형/Cue UI, P10 Grid, 사용자 인앱 알림·읽음함·이메일/push는 포함하지 않는다.

현행 [Domain §20.2](../../DOMAIN_SPECIFICATION.md#202-source-policy)는 YouTube를 production 파형 source로
허용하지 않는다. 첫 구현은 실제 사용할 영상의 이용 범위를 확인하고 Domain의 source·Job·결과 생명주기를
개정하는 것부터 시작한다. 이 계획만으로 현행 계약을 대체하지 않는다. 해당 경로를 허용할 수 없으면
YouTube 추출은 진행하지 않고 허용된 source 범위를 다시 결정한다.
Auth(04)·API(03/05)·server/transaction(06)·Query(07)·관측(09)·runtime(11)·배포(12)의
변경되는 계약만 같은 관심사의 구현 PR에서 갱신한다.

#### 구현 PR 순서와 통과 기준

| 관심사 | 구현·영향 경계 | 다음 작업 전 확인할 결과 |
| --- | --- | --- |
| 입력 계약·ARM64 분석 검증 | Domain source 계약, 고정 버전의 yt-dlp/ffmpeg/audiowaveform 이미지. 허용된 단일 videoId와 pipe/tmpfs 경계 | 실제 ARM64에서 짧은/긴 입력의 정상 JSON, CPU/RSS/tmpfs/출력 크기·소요 시간, 실패/timeout/강제 종료 뒤 음원·하위 프로세스 잔존 없음. 초반·중간·후반 anchor의 허용 오차와 실측 기록 |
| Job·결과 persistence | `packages/contracts` DTO/Zod, server schema·repository·service, Drizzle migration. UUIDv7·단수 snake_case 사용 | local Docker PostgreSQL에서 동시 생성·terminal 이후 재생성·attempt/source 조건부 반영·정상 JSON 보존·결과와 성공 상태의 atomic commit 확인 |
| 생성·조회·enqueue | Console ADMIN/MFA Route Handler·Ky/Query와 좁은 내부 Job API, Runner Unix socket/Queue push. worker·Runner의 앱 DB 직접 접근 금지 | 동시 POST·연속 클릭·응답 유실 재요청이 같은 jobId를 반환. enqueue 확정 실패/성공/불확실 구분, null enqueuedAt 소비, 추가 enqueue 없는 수렴 확인 |
| 소비·복구·운영 경계 | `infra/oci` Queue/IAM, 고정 배포 설정의 Runner/worker, 내부 결과 API. 기존 Web/Console metadata 차단 유지 | 실제 제한된 OCI 환경에서 long poll·visibility 연장/상실·DLQ·Runner/VM 재시작·잔존 container 정리·저장 후 delete 실패를 실증. token/socket/metadata/DB 격리 확인 |
| Console 상태 알림 | 단일 Node EventEmitter·SSE Route와 생성/진행/실패/재생성 UI, Query invalidate/refetch | DB commit 이후 알림, 이벤트 누락/중복·초기 연결·재연결·focus·서버 재시작 복구. MFA 만료/회수·abort 시 정리와 Caddy heartbeat 전달을 Playwright로 확인 |
| 통합 수용·Promotion | 실제 ARM64 이미지 digest와 기존 두 앱 배포·관측·복구 경로 연결 | 아래 수용 검증 완료 후 별도 Promotion. DB migration과 이전 호환 앱·Runner/worker digest의 복구 조합을 검토하고 진행 중 Job 보존 확인 |

한 관심사는 기본 한 PR로 검토하되 20파일/400줄 목표를 넘으면 독립 검증 가능한 계약·구현·전환으로
추가 분리한다. P08 내부에 새 단계 번호나 빈 플랫폼 package를 만들지 않는다. 소비·복구 검증 전에는
운영 Console의 생성 진입점을 활성화하지 않는다. 최초 분석 검증용 최소 renderer는 JSON·시간축 확인만
수행하며 P09의 editor 구현으로 확대하지 않는다.

#### 첫 persistence PR에서 고정할 판단

- 동일 `(song_id, video_id)`에서 `QUEUED/RUNNING`만 포함하는 **partial unique index**를 우선안으로 한다.
  충돌한 요청은 기존 active Job을 조회하며, INSERT에 성공한 요청만 enqueue를 소유한다.
  terminal 전환 경합과 transaction rollback은 실제 PostgreSQL 동시성 테스트로 확인한다.
  [PostgreSQL 17 partial index](https://www.postgresql.org/docs/17/indexes-partial.html)를 근거로 하며 최종 SQL은 생성 migration에서 검토한다.
- source가 현재 Song 영상과 일치하고 현재 `attempt_id`를 소유한 실행만 결과를 반영한다.
  Song 영상 변경·삭제와 실행/결과 반영의 경합, FK 삭제 정책과 기존 정상 파형 조회 조건을 DDL 전에 명시한다.
  파형 재생성이나 source 변경이 기존 Cue 시각을 자동 변경하지 않도록 한다.
- SDK retry와 enqueue 호출 소유권을 포함해 응답 유실을 추가 PutMessages로 복구하지 않는지 확인한다.
  stale 판정은 가장 늦은 enqueue 가능 시점 + 실제 최대 retention + 시계/관측 안전 여유로 정한다.
  전달이 확인된 Job의 retention 만료와 중단된 RUNNING 회수도 정리 대상·조건을 명시한다.
- Job·결과의 보관/삭제 기간, 조회 응답의 부재 표현·오류 코드, 내부 API 인증/인가 범위와 응답 유실 시
  재호출의 멱등성을 계약 테스트로 고정한다. 수치·endpoint는 구현 전 해당 DTO/배포 설정에 확정한다.

#### 알림의 최소 계약

상태·결과의 SSOT는 PostgreSQL이며 알림은 갱신 신호다. `waveform-job-updated`의 payload는
`{ jobId }`이고 브라우저는 Job/Waveform query를 invalidate한 뒤 다시 읽는다. 최초 연결 시에는
listener 등록과 현재 상태 조회 사이의 변경이 유실되지 않는 순서를 검증한다. 알림 실패는 commit된
성공이나 Queue delete 처리를 실패로 바꾸지 않는다. 연결 수명 중 세션 만료·권한 회수도 확인한다.
별도 Notification DB·범용 event bus·FCM/Web Push는 선행 도입하지 않는다. process/container가
둘 이상이 되는 변경은 process-local 알림 전제를 다시 검토한다. DLQ/Runner 장애의 운영 알림은
기존 OCI Monitoring/Notifications 절차 안에서 대상·임계값·담당을 정한다.

#### 실증 전 확정할 값과 최종 수용

worker 이미지·도구 버전/digest, 입력 길이·JSON byte·CPU/RAM/pids/tmpfs 한도·전체 timeout,
Queue retention·visibility·연장 주기·최대 delivery count·stale 여유, 시간축 허용 오차를
ARM64 측정과 실제 Queue 설정으로 고정한다. [OCI Queue 개요](https://docs.oracle.com/en-us/iaas/Content/queue/overview.htm)와
[소비 계약](https://docs.oracle.com/en-us/iaas/Content/queue/consume-messages.htm)의 retention/visibility를
혼동하지 않는다. [Queue IAM](https://docs.oracle.com/en-us/iaas/Content/queue/policy-reference.htm)에 맞춰
Instance Principal의 고정 Queue push/pull 범위를 제한하고, [Docker tmpfs](https://docs.docker.com/engine/storage/tmpfs/)의
swap 가능성과 memory 한도 포함 조건도 확인한다. 이 문서의 공식 문서 재확인은 2026-10-27이며 실제 OCI 실증과 구분한다.

각 구현 PR은 해당 단위/계약/PG/Playwright 검증과 저장소 필수 검사를 기록한다. P08 종료는
§3의 enqueue 응답 유실 시나리오, 실제 Queue 재전달·복구·권한 제한, 음원 비영속성,
3개 이상 anchor의 offset/drift와 JSON만 재조회하는 검증이 모두 근거를 남겼을 때 판정한다.
검증 전에는 배포 성공이나 mock 통과만으로 종료하지 않는다. 실행 상세는 각 PR, 단계 최종 결과는
완료 시점의 최종 결과 소유 문서에 두고 현재 다음 행동은 WORK에서만 갱신한다.

## 3. 검증과 전환 조건

- P02 전에는 기존 type-check/harness/lint/FSD/unit/format과 필요한 build를 실행한다. 이후 root `pnpm verify`가 workspace별 검사·독립 앱 Steiger·repo 경계 harness·운영 테스트·format·두 앱 build를 실행한다.
- schema 수정 → Drizzle migration 생성 → SQL 검토 → guarded local 적용 → 검증 순서를 지킨다. MFA replay·job 상태/멱등성·동시 저장은 local Docker PostgreSQL에서 확인하고 production 적용은 별도 실행 범위로 둔다.
- P07의 새 reader는 기존 가사/LRC writer 호환과 이관 경합·stale 탭 거절·다른 모드 불변·실패 rollback·공개 중단 후 legacy 재노출 방지를 검증하기 전 활성화하지 않는다.
- UI는 바뀐 selector·로그인·editor/SSE 연결 흐름을 Playwright로 확인한다. root config/harness 변경이 affected 검증에서 빠지거나 다른 workspace 정책을 섞지 않는지도 확인한다.
- P08은 실제 OCI Queue staging에서 long poll·재전달·visibility 연장·DLQ·runner/VM 재시작·결과 commit 후 ack 실패를 확인한다. mock만으로 완료하지 않는다.
- P08에서 연속 클릭·응답 유실 후 재요청·동시 POST가 동일 songId/videoId의 active Job 한 개를 재사용하고 새 message를 추가하지 않는지 검증한다. DB 원자성 수단은 구현 시 선택하고 terminal 이후 재생성은 허용한다.
- P06은 ARM64 빌드 전 동일 Stack의 Plan/Apply·두 repo push/pull·새 secret 읽기·새 Run Command exit 0을 실제 주체로 증명한다. 실패 시 해당 검사에서 중단한다. Web/Console metadata 차단은 Console secret 읽기 권한 추가 전 준비하고 실제 두 앱·재시작/복구 후까지 확인한다.
- P08은 Runner의 Instance Principal과 Queue push/pull 범위, Console의 제한된 Unix socket 호출, worker metadata 차단을 제한된 실제 OCI 환경에서 추가 검증하고 기존 Web/Console 차단을 재검증한다. 같은 VM의 IAM을 process별 권한 분리로 간주하지 않는다.
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

P06의 공개 유지·Web 인증 종료·F 전환은 [전체 결과](P06-RESULT.md)와 단계별 RESULT로 추적한다.
사전 준비/임시 검증 창의 재개 지시는 현재 절차가 아니다. 반복 작업은 [운영 안내](../../../../ops/oci/README.md)를 따른다.
P06-G는 별도 제안이며 구현 전 Domain/active 계약 개정이 필요하다. P07 선행 조건이 아니다.
Guide writer 전환 뒤 rollback은 새 guide를 읽는 호환 앱으로 제한하고 Song.lyrics의 파괴적 정리는 후속으로 둔다.

각 구현 PR은 `migration_main`을 대상으로 repository template과 한글 Conventional Commit → push → PR 절차를 따른다.
OCI Development 배포는 별도 `migration_main → migration_develop` Promotion PR로 진행하며 active 배포 runbook §21을 따른다.
후속 보류는 새 관리자 편집·초안/공개 UI·복원, Contribution/Discussion·Revision 승인, 현황판·팬 숙지/참여 응답, 공연별 다수 variant, DB role hardening, 닫힌 탭/서비스 전체 Web Push다.
자동 BPM/Alignment/GPU/ML, 자체 Queue/Notification framework는 로드맵에 넣지 않는다.
