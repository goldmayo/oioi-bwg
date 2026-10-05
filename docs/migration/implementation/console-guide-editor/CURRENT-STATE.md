---
title: "Console·다중 응원법·편집기 설계의 코드 근거"
kind: migration-evidence
status: recorded
snapshot_mode: frozen
source:
  repository: goldmayo/oioi-bwg
  branch: migration_develop
  commit: a8d157960adea83c26d692709a0ad45b71884c88
observed_at: "2026-10-05"
---

# 현재 구조 분석

이 문서는 [설계 제안](DESIGN.md)의 AS-IS 근거만 소유한다. 실제 운영 서버나 DB를 조회한 결과가
아니라 위 커밋의 코드·설정·기존 작업 기록을 읽은 결과다. 분기 전 작업 트리는 깨끗했고,
`git fetch origin migration_develop` 후 HEAD와 원격 기준 커밋이 일치했다.
사용자 지시에 따라 그 HEAD에서 `migration_console-guide-editor-design`을 생성했다.

## 1. 현재 상태 → 문제 → 변경 필요 여부

아래 링크는 저장소 상대 경로다. 재현 시 위 source commit을 checkout하여 해당 파일과 symbol을 확인한다.

| ID / 영역              | 현재 상태와 코드 근거                                                                                                                                                                                                                                                                          | 문제·제약                                                                                                                                                                                                        | 변경 필요 여부                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| E01 사용자 App         | [package.json](../../../../package.json), [곡 페이지](<../../../../src/app/(user)/songs/[slug]/page.tsx>): Next 16.3.3 / React 19.2.5 단일 App Router. `force-dynamic` RSC가 service를 직접 호출하여 `LyricsViewerClient`에 DTO 전달                                                           | 현재 viewer 입력에 선택된 guide identity가 없음. 이 페이지는 Query hydration을 사용하지 않음                                                                                                                     | 여러 guide를 전환하는 subtree에만 Query·hydration 도입         |
| E02 Admin              | [layout](<../../../../src/app/(admin)/admin/layout.tsx>), [편집 route](<../../../../src/app/(admin)/admin/edit/[slug]/page.tsx>): 같은 앱의 `/admin/albums`, `/admin/songs`, `/admin/edit/[slug]`; `/admin-login`도 같은 앱                                                                    | 사용자 앱과 runtime·배포·인증 설정 공유                                                                                                                                                                          | 별도 앱·컨테이너 및 기존 진입점 전환 필요                      |
| E03 인증               | [auth.ts](../../../../src/auth.ts), [authentication-service](../../../../src/server/services/authentication-service.ts): Auth.js `5.0.0-beta.32`, Credentials, Argon2id, JWT. callback은 `sub`만 보존. 로그인은 ACTIVE 확인                                                                    | TOTP, 관리자 전용 session, 명시적 만료 설정, 로그인 rate-limit 호출이 이 경로에 없음. 회원가입 OTP와 다름                                                                                                        | 기존 인증 재사용 + Console 전용 MFA·회수 경계 필요             |
| E04 인가               | [request-context](../../../../src/server/auth/request-context.ts), [ability](../../../../src/server/auth/ability.ts), [song-service](../../../../src/server/services/song-service.ts): 요청마다 DB role/status를 읽고 CASL 생성. service의 `requireAdmin`이 인증·`manage all` 확인             | **현재도 backend 인가는 있음.** 다만 일반 로그인한 ADMIN과 MFA 완료 ADMIN을 구분하지 않음                                                                                                                        | service context에 검증된 Console session assurance 추가        |
| E05 API                | [lyrics PATCH](../../../../src/app/api/admin/songs/[id]/lyrics/route.ts), [HTTP boundary](../../../../src/server/http/api-response.ts), [song browser API](../../../../src/entities/song/api/api.ts): Query → Ky → Route → Service → Repository. request/response Zod, 실패만 error envelope   | song 단위 저장이며 revision·낙관적 충돌 검사가 없음. 해당 PATCH/공통 parser에는 mutation Origin 검사가 없음                                                                                                      | guide/revision API 추가, 기존 쓰기 경로 이관·종료, Origin 검증 |
| E06 DB                 | [schema](../../../../src/server/db/schema.ts): `Album`, `Song`, `account`, `profile`, `password_credential`, 이메일 인증 challenge/counter. `Song`은 `lyrics jsonb`, `youtubeId`, `hasOfficialCheer` 소유                                                                                      | CheerGuide/Revision/Cue/Event/Waveform/MFA/audit 테이블 없음. entity 디렉터리 이름은 DB 모델 존재의 증거가 아님                                                                                                  | additive schema와 데이터 분류·변환 필요                        |
| E07 Song 관계          | [song-repository](../../../../src/server/repositories/song-repository.ts), `saveSongLyrics`: 한 Song에 가사 JSON 하나를 덮어씀. Album FK cascade, Song slug unique, service는 non-null slug 변경 거절                                                                                          | 사실상 응원법 1개. `hasOfficialCheer`는 nullable boolean으로 공식 출처·공연 종류·승인 이력을 설명하지 못함                                                                                                       | Song identity/slug 유지, guide 여러 개와 승인 이력 분리        |
| E08 content 계약       | [song contract](../../../../src/shared/contracts/song.ts): `LyricLine.startTime` 초, `segments[].text/isCheer/isEcho/startTimeOffset`, `isExtra`; line/segment ID와 종료 시간 없음                                                                                                             | 곡 가사와 응원 강조가 한 구조에 섞임. text만 Cue로 복사하면 강조·추임새·부분 offset 손실                                                                                                                         | lossless mapper, 안정 ID, ms 경계·nullable duration 필요       |
| E09 공개 범위          | `getSongDetailBySlug`/`mapSongDetail`: Song·Album visible, title/slug/youtubeId 확인. 보관 lyrics 파싱 실패는 계약 오류. [visibility tests](../../../../src/server/repositories/public-visibility.test.ts) 존재                                                                                | guide 도입 후에도 숨긴 곡/앨범이 새 endpoint로 노출되면 안 됨                                                                                                                                                    | 공개 조회 predicate와 승인된 revision filtering 함께 유지      |
| E10 편집 model         | [useLyricsEditor](../../../../src/features/manage-lyrics/model/useLyricsEditor.ts), [useAdminEditor](../../../../src/features/manage-lyrics/model/useAdminEditor.ts): LRC import, 캡처, 녹화 자동 다음 행, extra/segment 추가, Undo/Redo 50개, global/row offset. 캡처는 소수 둘째 자리 반올림 | React state가 전체 draft/history 소유. 고정 ID 부재. 모든 미세 변경이 history snapshot. 현재 RHF draft 표준과 차이                                                                                               | 기능 재사용, gesture별 history와 단일 draft 소유권으로 정리    |
| E11 편집 UI            | [LyricsEditorClient](../../../../src/features/manage-lyrics/ui/LyricsEditorClient.tsx): Q/W/E/R, YouTube와 표, responsive panels. [preview](../../../../src/features/manage-lyrics/ui/LyricsTimelinePreview.tsx)는 GSAP로 150 px/s 이동하는 읽기용 rail                                        | 이미 타임라인 **프리뷰**는 있으나 waveform·drag 시간 편집·BPM/snap/loop는 없음. 행 컴포넌트가 startTime을 key로 사용                                                                                             | rail 전체 재사용보다는 시간 좌표·선택·편집 track 추가          |
| E12 재생               | [YouTubePlayer](../../../../src/shared/ui/YouTubePlayer.tsx): IFrame Player API, requestAnimationFrame으로 currentTime 전달. `useAdWatcher`로 광고 중 timing update 차단                                                                                                                       | PCM/audio buffer를 얻는 구현 없음. 화면 rAF는 sample-accurate audio clock이 아님                                                                                                                                 | YouTube fallback 유지, 파일 재생은 별도 clock adapter          |
| E13 저장/cache         | [AdminLyricsEditor](<../../../../src/app/(admin)/admin/edit/[slug]/_ui/AdminLyricsEditor.tsx>): Query mutation 성공 시 adminList invalidate; editor 초기값은 RSC props                                                                                                                         | 새 공개 guide cache나 다른 origin의 브라우저는 이 invalidate로 갱신되지 않음                                                                                                                                     | guide key·draft version·공개 refresh 정책 필요                 |
| E14 Docker/local       | [Dockerfile](../../../../Dockerfile), [compose.dev.yml](../../../../compose.dev.yml): Node 22.16.0 standalone image, 비root node. local Compose PostgreSQL 17 + Next                                                                                                                           | Docker target/image 하나. local dump 복원 절차 별도                                                                                                                                                              | web/console build target, port/env/health 분리                 |
| E15 원격 runtime       | [compose.oci-development.yml](../../../../compose.oci-development.yml): `app` 하나, loopback port, external DB network, digest image, env file, log rotation                                                                                                                                   | repository에 실제 운영 Caddyfile 없음. www/console DNS·인증서·현재 host routing은 이 조사로 확인 불가                                                                                                            | 기존 host inventory 확인 후 routing 계획 적용                  |
| E16 CI/CD              | [.github/workflows/verify.yml](../../../../.github/workflows/verify.yml), [ops README](../../../../ops/oci/README.md): PR 검증, migration_develop push에서 ARM64 image → OCIR digest → GitHub Actions OCI Run Command → host deploy/health/smoke/rollback                                      | 한 app/digest/env 전제. [헌법](../../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md)·[runbook](../../oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md)은 여전히 OCI DevOps 규정 | 2개 artifact release manifest 및 상위 SSOT 정합성 결정 선행    |
| E17 storage/connection | [DB singleton](../../../../src/server/db/index.ts): process당 max 10 connections. [R2 upload](../../../../src/server/storage/upload-public-asset.ts)와 관리자 route-local [Server Action](<../../../../src/app/(admin)/admin/albums/_lib/upload-album-image-action.ts>) 존재                   | 앱 2개면 pool 상한도 합산. 이미지 업로드 권한을 놓치면 legacy 우회 진입점이 남음                                                                                                                                 | migration 포함 전체 pool 예산, upload action의 동일 MFA 인가   |
| E18 email              | [OTP service](../../../../src/server/services/email-verification-service.ts), [delivery](../../../../src/server/email/oci-email-delivery.ts): 회원가입용 challenge, PostgreSQL 원자 counter, OCI Email Delivery                                                                                | 가입 이메일 소유 증명과 관리자 로그인 2차 인증의 목적이 다름                                                                                                                                                     | email transport 재사용 가능하나 challenge/token은 목적별 분리  |

## 2. 현재 실행 흐름

```text
사용자 /songs/[slug] RSC → getSongDetailBySlug → repository → Song.lyrics
                                     ↓ DTO
                              LyricsViewerClient → YouTube iframe

/admin-login → Auth.js Credentials → Argon2id/ACTIVE → JWT(sub)
/admin RSC / API → getRequestContext → DB role/status → CASL
                             ↓
                       service requireAdmin
                             ↓
                    update Song.lyrics / youtubeId
```

현재 service guard가 있으므로 “UI만 숨기는 보안”이라고 단정하지 않는다.
이번 요구로 새로 필요한 것은 **Console에서 MFA를 마친 세션이어야 관리 use case를 실행할 수 있다**는 조건이다.

## 3. 명세와 코드·새 요구의 차이

| 근거                                                                                             | 현재 규정                                                                                     | 이번 설계에서 필요한 결정                                                                                            |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [Domain §8, §14](../../DOMAIN_SPECIFICATION.md)                                                  | FAN/FESTIVAL, UNIQUE(song, mode). CONCERT는 PerformanceType이며 FAN 추천                      | 사용자가 FAN→FESTIVAL/CONCERT 분리와 최종 세 종류를 확정. 상위 명세의 분류·공식 잠금·공연 추천 규칙 개정 필요        |
| Domain §10, §21, §23                                                                             | APPROVED immutable, 활성 revision 최대 1개, Cue는 revision 소속                               | 현재 Song JSON 덮어쓰기에서 guide/revision 경계로 전환해야 함                                                        |
| Domain §20                                                                                       | 정식 source transient 사용, 원본 영구 저장 금지, YouTube는 재생/참조, 초기 Python Worker 가정 | 사용자는 임시 처리를 포함한 웹서버 음원 비전송 요구. YouTube 기본 편집·선택적 로컬 분석에 맞춰 worker 가정 개정 필요 |
| Domain AUTH-006 / [Auth §29](../../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md) | Domain은 비밀번호·이메일 변경 등 전체 회수 요구. Auth v1은 세션별 회수 미도입                 | Console MFA reset/회수 요구에 맞춰 Console 범위 session registry를 승인받고 반영                                     |
| [Form §4](../../oioi-bwg-architecture-clean-v1/08-form-state-architecture.md) / E10              | RHF가 draft 소유 / 현재 lyrics useState                                                       | 새 editor는 RHF draft와 UI transient state를 구분; 독립 store 도입을 기본으로 삼지 않음                              |
| 헌법 §4, 배포 §21 / E16                                                                          | OCI DevOps가 CD 소유 / 실제는 direct Run Command                                              | [기존 M9 기록](../M9-ZERO-EXTRA-COST-CD.md)은 실제 변경 근거이지만 상위 규칙을 자동 대체하지 못함                    |

이 문서 작성 중 active SSOT를 변경하지 않았다. 사용자가 확정한 제품 방향은 위 표와 설계 D01/D04에
반영했고, 그 외 기술 제안·세부 정책을 확정된 상위 규칙으로 처리하지 않았다.
M7 DATA 기반 finding과 별개의 future-domain 설계이며 기존 M7 결과를 재작성하지 않는다.

## 4. 미확인 사항과 조사 방법

| 미확인                                | 구현 전 필요한 근거                                                               | 이 단계의 처리                                        |
| ------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 곡 수, JSON 이상치, boolean별 분포    | 승인된 `.local` dump를 guard 경로로 복원한 local PostgreSQL에서 읽기 전용 profile | DB를 열지 않았으므로 수치·backfill 성공률을 쓰지 않음 |
| 기존 비공식 응원법의 분류             | 운영자가 source/문맥을 검토한 매핑 목록                                           | false/null을 FESTIVAL 또는 CONCERT로 추정 금지        |
| 음원 보유·이용 범위                   | 운영자가 보유한 파일·이용조건·서비스 영상과 같은 master인지 확인                  | 음원 없는 workflow를 MVP의 필수 경로로 설계           |
| 실제 배포 hostname·Caddy·VM 자원 여유 | 승인된 host inventory와 staging smoke                                             | repo 설정을 현재 production 관찰값이라고 쓰지 않음    |
| 편집 소요 시간·정확도·bundle 크기     | 동일 과제로 기존 editor와 prototype 측정                                          | 기술 검증 문서의 값은 목표/측정 계획이며 실측 아님    |

## 5. 조사 이력

실행한 read-only 조사는 `git status`, `git rev-parse`, `git log`, `git fetch`, `rg`, 파일 읽기 및
공식 웹 문서 확인이다. application 실행·DB 접속·schema migration·오디오 분석·성능 벤치마크는 하지 않았다.
문서 내용/링크 검증과 push hook 결과는 이 변경의 PR에 별도 기록한다.
