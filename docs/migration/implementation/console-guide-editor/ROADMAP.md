---
title: "Console·다중 응원법·편집기 단계별 구현 로드맵"
kind: migration-plan
status: draft
authority: plan
source_commit: a8d157960adea83c26d692709a0ad45b71884c88
created_at: "2026-10-05"
---

# 단계와 PR 분해

[설계 제안](DESIGN.md)과 [코드 근거](CURRENT-STATE.md)를 입력으로 한다. 아래 PR은 **미구현 계획**이다.
이번 문서 PR을 이 기능들이 구현되었다는 결과로 기록하지 않는다. 실데이터·MFA 정책·workspace build의
불확실성이 있어 달력 날짜나 확정 인일 견적은 제시하지 않는다.

## 1. 순서와 병행 가능한 작업선

| Phase                 | 목적 / 출구 조건                                                         | PR      | 원 요청과 달라진 이유                                         |
| --------------------- | ------------------------------------------------------------------------ | ------- | ------------------------------------------------------------- |
| 0 조사·규칙 정리      | 현황 고정, 도메인/인증/배포/source의 상위 명세 충돌 정리, 수동 매핑 승인 | P00~P05 | 확정된 FAN 분리와 서버 음원 비전송 조건을 먼저 반영           |
| 1 Guide/Revision 기반 | 기존 data 호환, 승인본 불변, 수동 분류 migration, 공개 selector          | P10~P17 | 단순 enum과 덮어쓰기 모델로는 명세 불변성을 보장 못함         |
| 2 Console 분리 준비   | 두 앱 build·최소 shared 경계, **아직 공개 전환하지 않음**                | P20~P22 | 별도 container 준비와 public activation을 분리                |
| 3 Console 인증·전환   | MFA/recovery/인가·DB role·두 image·운영 smoke 모두 통과                  | P30~P37 | MFA를 Console 외부 공개보다 앞에 둠                           |
| 4 Timeline MVP        | YouTube + 시간 ruler/playhead + Cue drag/Inspector, explicit save        | P40~P41 | 파형은 입력 제약 때문에 MVP 필수 조건에서 제외                |
| 5 Beat Grid           | BPM·첫 박·Snap/Nudge, 기존 Cue 불변, ms 저장                             | P42~P43 | 자동 분석 없이 가장 큰 작업시간 절감 후보                     |
| 6 생산성              | Loop/shortcut/수동 marker/충돌 복구, 작업시간 비교                       | P44~P45 | 이미 있는 Undo/캡처를 재사용하여 반복 재청취 절감             |
| 7 선택적 로컬 분석    | 로컬 파형, 선택적 JSON import, BPM/Onset 후보 평가                       | P50~P52 | 음원·PCM·stem은 서버 비전송, 필요성/허용 범위 확인 뒤만 착수  |
| 8 Alignment R&D       | 실제 가사 alignment의 실효성 보고서만                                    | P60     | 채택 gate를 통과한 경우에만 연구, 운영 ML infrastructure 없음 |

논리적 의존성은 다음과 같다. 이는 agent 병렬 실행 지시가 아니라 향후 개발 일정의 작업선이다.

```text
P00~P05 → Guide schema/mapper → backfill → public API → selector → write cutover
P01/P04 → workspace/contracts/server → console app ───────────────┐
P02 → MFA persistence → enrollment → challenge/session → recovery ├→ 운영 전환
                                      → 전체 service guard ──────┘
P00/P03/P05 → stable ID/time adapter → 수동 grid/nudge/loop quick win
                           └→ revision draft 연결 → timeline drag
로컬 분석 경로 채택 → waveform → BPM/onset 실험 → 필요할 때만 alignment R&D
```

P40의 editor state/time 정리는 작은 concern으로 현 앱에서 먼저 할 수 있다. 수동 Grid/Loop도 새 DB 모델을
기다리는 동안 검증 가능하지만, 영구 timing 설정·draft save는 P14의 revision 계약에 붙인다.
두 앱에 editor를 복사해 병행 개발하지 않고 이동 전/후 같은 editor 소스를 사용한다.

## 2. PR 공통 완료 조건

- 모든 PR은 `migration_*` 브랜치, target `migration_develop`, 제목/커밋은 `type(scope): 한글 요약`으로 한다.
- 목표는 생성 파일·lockfile 제외 20개 파일/400줄 이하다. 표의 한 작업도 이 한도를 넘으면 계약/순수함수/전달 계층/UI로 더 나눈다. 단순 앱 경로 이동은 rename-only 준비 PR로 분리하고 필요한 예외의 리뷰 순서를 명시한다.
- 코드 PR은 `pnpm type-check`, `pnpm test:harness`, `pnpm lint`, `pnpm lint:fsd`, `pnpm test:unit:run`, `pnpm format:check`; runtime/build 위험이 있으면 `pnpm build`를 실행한다. workspace 도입 후에는 두 앱을 포함하도록 script를 갱신한다.
- SQL/동시성/인가 변경은 mocked test만으로 완료하지 않는다. local Docker PostgreSQL의 관련 integration 검증을 추가한다. 임의 seed/production credential을 사용하지 않는다.
- UI 동작 변경은 해당 Playwright 흐름을 검증한다. 핵심은 focus/한 손 전환/dirty draft/키보드·IME/동시 응답/drag 취소다. 테스트 도구의 config를 먼저 확인한다.
- 순수 문서 PR은 내용·링크·format 검증만 계획한다. push hook이 검증을 실행하면 그 사실과 결과를 별도로 보고한다.
- schema의 기준 순서는 수정→migration 생성→SQL 검토→명시 local 적용→검증이다. 운영 migration은 승인된 별도 release 작업이며 이 계획으로 production 실행을 승인한 것으로 해석하지 않는다.
- 각 완료 PR은 해당 concern의 실제 결과/검증/남은 항목을 기록한다. 초안을 결과에 맞춰 소급 재작성하지 않는다.

아래 `DB / API / UI`는 각각 **migration 여부 / 외부 계약 변경 여부 / 사용자 화면 변경 여부**다.
`없음`이어도 관련 내부 함수·테스트가 바뀔 수 있다. `local`은 운영 변경이 아닌 조사/검증을 뜻한다.

## 3. Phase 0 — 상위 규칙과 입력 확정

| ID / PR 제목                                          | 목적·변경 범위                                                                                                                   | DB / API / UI            | Risk                                   | 선행 작업              | 완료 조건                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------- | ---------------------- | ---------------------------------------------------------------- |
| P00 `docs(domain): 응원법 분류와 이력 전환 정책 정리` | FAN→FESTIVAL/CONCERT, OFFICIAL 정의, 잠금·기여/승인·미분류 보존·삭제 lifecycle, current pointer와 group cue 정책을 Domain에 반영 | 없음 / 없음 / 없음       | 기존 FAN/공식 의미 손실                | 본 설계 검토           | 사용자 방향과 legacy 수동 분류 기준·test oracle가 일치           |
| P01 `docs(architecture): 웹과 콘솔 앱 경계 정의`      | 헌법·02/06/11/12의 2-app·server package·FSD·image 경계 개정                                                                      | 없음 / 없음 / 없음       | package가 client/server 우회 통로가 됨 | D02 검토               | 책임·public exports·root config 위치 확정                        |
| P02 `docs(auth): 콘솔 다중 인증과 복구 정책 정의`     | Auth 04 및 Domain의 session/revoke/bootstrap/복구/기간/감사 기준 정합화                                                          | 없음 / 없음 / 없음       | 마지막 ADMIN 잠금, recovery 우회       | D03/D07 검토           | enrollment grant와 회수 이벤트·절대/idle 기한 확정               |
| P03 `docs(audio): 서버 음원 비전송 편집 정책 정의`    | Domain §20의 Python Worker 가정을 이번 Console 범위에서 제거/보류하고 YouTube 기본 경로·로컬 파형 조건 명시                      | 없음 / 없음 / 없음       | 기존 source 정책을 몰래 완화           | 사용자 추가 제약       | 다운로드/음원 API 없는 경로 확정; yt-dlp 허용 여부는 별도        |
| P04 `docs(deploy): 배포 경로와 콘솔 전환 기준 정리`   | M9 기록·실제 workflow를 근거로 헌법/12의 CD 소유권 충돌 해결, host inventory checklist                                           | 없음 / 없음 / 없음       | 구현 기록을 상위 권한으로 오인         | E16·운영 기록 검토     | direct Run Command 유지 여부와 2-app rollout/rollback owner 확정 |
| P05 `chore(data): 기존 가사 분류와 변환 입력 검증`    | local dump read-only profile·변환 fixture·운영자 매핑 manifest 형식. 원본 음원·민감 row를 repo에 넣지 않음                       | local 조사 / 없음 / 없음 | 공식 flag 오분류, float/offset 손실    | P00, 승인된 local dump | 곡별 대상/보류 목록, 이상치 처리·일반/extra/echo 예제가 검토됨   |

## 4. Phase 1 — Guide/Revision·사용자 선택

| ID / PR 제목                                               | 목적·변경 범위                                                                                                | DB / API / UI                                | Risk                                  | 선행 작업                        | 완료 조건                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------- | -------------------------------- | --------------------------------------------------------------------- |
| P10 `feat(guide): 응원법과 리비전 스키마 추가`             | guide/revision, current pointer 소속, active revision partial unique, FK/index와 local migration              | 추가 / 없음 / 없음                           | 동시 draft 생성·다른 guide pointer    | P00/P05                          | 실제 PG에서 중복/잘못된 pointer 거절, 기존 앱 호환                    |
| P11 `feat(cue): 가사 표현을 보존하는 큐 저장 기반 추가`    | Cue schema·content version·ms contract, legacy↔Cue 순수 mapper·constraint                                     | 추가 / DTO 준비 / 없음                       | 가사/강조/offset/순서 손실            | P10                              | round-trip fixture, point/overlap/음수 이상치 정책 검증               |
| P12 `feat(guide): 리비전 저장과 승인 서비스 추가`          | repo executor·state/version 조건·approval transaction·audit. 토론/알림 미구현 범위는 P00에 명시된 최소 절차만 | audit 추가 / 내부 service / 없음             | APPROVED 수정, 동시 저장/publish      | P10/P11                          | 실제 PG 동시 쓰기 거절, rollback 시 pointer/audit 일관                |
| P13 `chore(guide): 기존 가사 백필과 대조 도구 추가`        | 수동 매핑 기반 idempotent backfill·checkpoint/hash·dry-run·shadow projection 비교                             | data migration 도구 / 없음 / 없음            | partial failure·잘못된 승인 귀속      | P05/P12                          | local 복원본에서 재실행 중복 0·보류 곡 유지·대조 보고                 |
| P14 `feat(guide): 공개 조회와 초안 저장 계약 추가`         | 공개 list/detail와 Console draft API·Zod·error·Query key; 크면 public/read와 draft/write PR로 분리            | 없음 / 추가 / 없음                           | draft 노출·다른 Song ID 접근·409 누락 | P12/P13                          | guest read filtering, USER/REVIEWER write 거절, version conflict 검증 |
| P15 `feat(guide): 곡별 응원법 선택 화면 추가`              | segmented/switcher·nuqs URL·RSC seed/Query·재생 유지·오류 상태                                                | 없음 / P14 소비 / 추가                       | race·모바일 focus·source mismatch     | P14                              | 0/1/2~3/다수·URL fallback·재생 중 전환 E2E                            |
| P16 `refactor(guide): 기존 가사 쓰기를 리비전 경로로 전환` | 기존 editor 저장·create/update LRC·delete guard 연결, 단일 writer 전환, 기존 DTO adapter                      | data 최종 sync / 기존 write 변경 / 저장 상태 | 구 endpoint가 승인본을 덮어씀         | P13/P14 및 쓰기 중지 계획        | 모든 쓰기 진입점 inventory 닫힘, 미전환 곡 보존·호환 rollback 검증    |
| P17 `refactor(guide): 검증된 레거시 가사 경로 정리`        | rollback 기간 후 obsolete endpoint/컬럼·flag 제거 제안                                                        | 삭제 가능 / 제거 / 없음                      | 새 데이터 rollback 불가               | P15/P16 운영 확인·별도 적용 계획 | backup 복구·호환 release 확인 후만 실행; 일정 고정 안 함              |

P14의 admin 경로는 초기 현재 guard를 사용하더라도 P34 전에는 별도 Console의 외부 공개를 허용하지 않는다.
P12는 장기 Contribution/Discussion/Notification 전체 기능을 구현하는 PR이 아니다. 기존 명세가 요구하는
불변성·승인 절차를 줄여야 한다면 P00에서 admin-only 단계의 적용 범위를 명시해야 하며 service가 임의 생략하지 않는다.

## 5. Phase 2~3 — 앱·인증·배포

| ID / PR 제목                                               | 목적·변경 범위                                                                                               | DB / API / UI                         | Risk                                           | 선행 작업                   | 완료 조건                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ---------------------------------------------- | --------------------------- | ---------------------------------------------------------------------- |
| P20 `refactor(workspace): 웹 앱의 실행 경로 분리`          | workspace/app root·scripts/config·기존 web 경로 이동 준비. rename-only concern과 도구 경계가 크면 분리       | 없음 / 없음 / 없음                    | Next tracing/경로·CI 회귀                      | P01/P04                     | 기존 URL·public asset·standalone build 동작 보존                       |
| P21 `refactor(workspace): 공통 계약과 서버 소스 경계 추출` | contracts/server export, server-only/import harness, schema/migration 단일 소유                              | 없음 / 형식 동일 / 없음               | client에 persistence 포함, 공통 package 과대화 | P20                         | client/server 경계 검사, 두 consumer build·service test                |
| P22 `feat(console): 운영 앱 진입점과 화면 이관`            | console Next app·admin route/UI 이동, 필요한 primitive만 공유. 공개 route 활성화는 보류                      | 없음 / console 경로 준비 / 이관       | web/console 서로 직접 import                   | P21                         | 격리 환경의 두 앱 실행·route 소유권 표 완성                            |
| P30 `feat(auth): 콘솔 인증 저장 기반 추가`                 | factor/challenge/recovery/session/counter schema와 암호화 key version·replay repository                      | 추가 / 없음 / 없음                    | secret 노출·원자성 오류                        | P02                         | RFC vector·암호화 실패·동시 counter/replay PG 검증                     |
| P31 `feat(auth): 관리자 다중 인증 등록 제공`               | password pre-auth·bootstrap grant·QR 생성·등록 확인·backup 일회 표시                                         | 없음 / enrollment 추가 / 등록 UI      | password만으로 factor 선점                     | P30/P22                     | 등록 전 API 거절·grant 만료/재사용·secret 로그 부재                    |
| P32 `feat(auth): 다중 인증 완료 세션 발급`                 | challenge·rate limit·Auth.js grant provider·host cookie·sid registry·Origin/CSRF                             | 없음 / login 추가 / challenge UI      | MFA 우회, fixation, web cookie 혼동            | P30/P31                     | password-only/다른 origin/replay/두 탭 실패, 정상 TOTP 성공            |
| P33 `feat(auth): 복구와 관리자 세션 회수 제공`             | 제한 recovery grant·reset·step-up·logout/revoke·보안 event·runbook                                           | 없음 / recovery/revoke 추가 / 복구 UI | 마지막 관리자 잠금·코드 재사용                 | P32                         | 코드 동시 소비 1회, reset 후 모든 sid 거절, 단독 운영자 복구 rehearsal |
| P34 `fix(auth): 모든 관리 서비스에 콘솔 인증 강제`         | app context와 service assurance, album/song/lyrics/upload/publish 전체 guard·직접 호출 tests                 | 없음 / guard 강화 / 만료 UX           | legacy SA/API 우회                             | P32/P33, P16 경계 inventory | USER/REVIEWER/password-only ADMIN/회수 session 모두 거절               |
| P35 `feat(deploy): 웹과 콘솔 배포 산출물 분리`             | Docker targets·Compose env/ports·CI 두 build·digest pair·host deploy script·분리 DB runtime role             | role 변경 / 없음 / 없음               | pool 증가·shared migration 호환·secret 공유    | P04/P22/P34                 | 두 image health, wrong cookie/DB 권한 차단, 한쪽 rollback ops test     |
| P36 `feat(console): 콘솔 도메인 전환과 기존 경로 종료`     | 승인된 staging routing/DNS/TLS 계획·web admin route/Action 제거. 과거 URL은 알려진 console path로만 redirect | 없음 / legacy 종료 / URL 전환         | 구 경로 여전히 쓰기 가능, open redirect        | P35 + 복구/인가 smoke       | 직접 web 관리 호출 실패, 두 host/API/로그아웃·rollback E2E             |
| P37 `chore(console): 운영 권한과 배포 검증 기록`           | 실제 배포 기록·secret 범위·CPU/RAM/pool·audit·복구 결과                                                      | 운영 확인 / 없음 / 없음               | repo 설정만 보고 production 완료 주장          | P36 및 명시 운영 실행 범위  | 실제 evidence만 기록, 미실행 smoke와 남은 운영 작업 구분               |

P35의 코드와 SQL/role 도구는 검증 가능하게 만들되 실제 production 변경은 별도 실행 승인을 따른다.
web에서 필요 없는 admin API를 proxy 규칙만으로 숨기지 않고 route export와 Action도 제거한다.
현재 사용자 auth/API가 사용하는 DB 권한은 최소 필요 범위로 계속 유지한다.

## 6. Phase 4~6 — 파형 없이 완성하는 편집기

| ID / PR 제목                                            | 목적·변경 범위                                                                         | DB / API / UI                | Risk                                | 선행 작업                    | 완료 조건                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------- | ---------------------------- | --------------------------------------------------------------- |
| P40 `refactor(editor): 큐 식별자와 편집 상태 경계 정리` | stable ID·seconds/ms mapper·RHF draft·gesture history, 기존 capture/import/offset 유지 | 없음 / adapter / 동작 보존   | startTime key 변경·Undo 손실        | P00/P03/P05; 영구 저장은 P14 | 기존 가사/extra/echo 보존, dirty draft에 refetch overwrite 없음 |
| P41 `feat(editor): 큐 타임라인 이동과 재생 위치 편집`   | ruler·scroll/zoom·playhead·drag·Inspector·nullable duration resize                     | 없음 / P14 소비 / 추가       | 서로 다른 clock·gesture당 다중 저장 | P40/P14                      | pointer 취소/한 번 undo·겹침·끝 경계·YouTube seek 검증          |
| P42 `feat(editor): 수동 박자 격자와 첫 박 설정`         | quarter BPM·4/4·beatOffset·grid 표시, revision timing config                           | JSON 필드 계약 / 확장 / 추가 | source offset과 beat offset 혼동    | P40/P14                      | 120 BPM grid 수식·tempo 변경 후 기존 Cue 불변                   |
| P43 `feat(editor): 격자 스냅과 미세 이동 제공`          | snap/일시 해제·resolution·nudge·선택 quantize                                          | 없음 / 없음 / 추가           | offbeat 강제·부동소수 누적          | P41/P42                      | 32.137→32.125 예제, 경계/tie/undo, drag 후 duration 보존        |
| P44 `feat(editor): 구간 반복과 마커 탐색 추가`          | A-B/Cue 주변 loop·수동 marker·단축키·IME/focus 경계                                    | 필요 시 설정 / 최소 / 추가   | YouTube 광고/seek 지연·Tab trap     | P40; 전체 통합 P41           | best-effort loop 명시·키보드/IME·영상 focus 복귀 E2E            |
| P45 `feat(editor): 저장 충돌 복구와 생산성 검증`        | 409 비교·draft export/재적용·401 재로그인 유지·작업시간 측정 보고                      | 없음 / error 소비 / 추가     | 데이터 덮어쓰기·개선 근거 부재      | P16/P34/P41~P44              | 두 탭 충돌에서 draft 보존, 같은 과제 전후 시간/오차 보고        |

P42/P44의 로컬 draft prototype은 P40 후 먼저 검증할 수 있다. 다만 shared settings를 backend에 저장하는
release는 P14에 의존한다. 자동 저장이나 대규모 state library 도입은 이 작업의 전제조건이 아니다.

## 7. Phase 7~8 — 선택 실험

| ID / PR 제목                                               | 목적·변경 범위                                                                            | DB / API / UI                     | Risk                                          | 선행 작업                                 | 완료 조건                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| P50 `feat(editor): 로컬 음원 파형 미리보기 제공`           | 선택 파일을 browser memory에서만 decode, wavesurfer dynamic chunk·source mapping·fallback | 없음 / 없음 / 선택 추가           | 메모리·다른 master·무심코 음원 업로드         | P03/P41 + 로컬 경로 채택                  | network에 audio/PCM 0바이트, 해제/취소·실패 fallback·source 3점 확인 |
| P51 `feat(editor): 파형과 분석 메타데이터 가져오기`        | bounded/versioned peak JSON import·검증/보관. 필요할 때만 waveform schema/R2 asset        | 추가 가능 / JSON 추가 / 선택 추가 | JSON을 음원/악성 대용량 운반 경로로 사용      | P50 또는 허용된 local 분석 workflow       | byte/count/수치 범위·reference 검증, 원본 비전송·Cue 불변            |
| P52 `experiment(audio): 박자와 온셋 후보의 편집 효과 검증` | browser Worker 또는 관리자 PC CLI 기준 실험, 후보 track·채택/취소·보고서                  | 없음 / 없음 / 실험 UI             | peak를 vocal/beat로 오인·후보 검수 비용       | P45/P50, 이용 가능한 입력                 | 채택률·오류/시간 측정, 개선 없으면 비활성 유지                       |
| P60 `experiment(audio): 실제 가사 정렬의 실효성 조사`      | local WhisperX/MFA/DTW/stem 비교, 입력 정규화·언어/반복후렴 평가·보고서                   | 없음 / 없음 / 없음                | 음원에 없는 응원 문구 hallucination·모델 비용 | P52 후 남은 문제가 확인되고 R&D 범위 확정 | 실제 가사 timing·보정 포함 시간·CPU/RAM 보고, no-go 가능             |

서버 yt-dlp/음원 업로드/서버 분석 PR은 목록에 없다. 로컬 yt-dlp 기반 acquisition도 아직 승인된
제품 경로가 아니므로 P50의 전제로 묶지 않는다. 별도 source 허용·정책 판단을 마친 경우에만 독립 도구로
검토하고 service API dependency를 추가하지 않는다.

## 8. release gate와 rollback

| checkpoint        | 공개/전환 조건                                                                | 실패 시                                                        |
| ----------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Guide public read | 분류 확인·shadow 비교·공개 filter·legacy URL/DTO 호환                         | 기존 reader 유지; 미분류 곡 억지 전환 금지                     |
| Guide writer      | 모든 쓰기 경로 전환·revision concurrency·audit·backup 확인                    | 쓰기 중지, 새 schema 호환 reader release로 복구                |
| Console public    | MFA+recovery+service assurance+web legacy route 종료+cookie/Origin+host smoke | Console routing 비활성, 검증된 기존 운영 경로의 접근 제한 유지 |
| Timeline/Grid     | legacy 기능 보존·source 시간축·pointer/키보드·409 복구                        | 편집 화면 feature flag만 이전 UI로 복귀; 저장된 Cue는 유지     |
| 자동 후보         | 정확도뿐 아니라 검수 포함 편집시간 개선                                       | 후보 생성 기능 OFF, 수동 workflow 유지                         |

Console rollout을 되돌릴 때 password-only 관리 API를 다시 공개하는 rollback은 허용하지 않는다.
운영 전환 완료는 source commit·image digest·schema 상태·실제 검증 결과를 함께 남긴 경우에만 보고한다.
