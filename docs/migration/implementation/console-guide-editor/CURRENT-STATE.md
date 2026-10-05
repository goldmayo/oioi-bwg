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

## 1. 현재 코드와 제약

아래 링크는 저장소 상대 경로다. 재현 시 위 source commit을 checkout하여 해당 파일과 symbol을 확인한다.

| ID / 영역              | 현재 상태와 코드 근거                                                                                                                                                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E01 사용자 App         | [package.json](../../../../package.json), [곡 페이지](<../../../../src/app/(user)/songs/[slug]/page.tsx>): Next 16.3.3 / React 19.2.5 단일 App Router. `force-dynamic` RSC가 service를 직접 호출하여 `LyricsViewerClient`에 DTO 전달                                                           |
| E02 Admin              | [layout](<../../../../src/app/(admin)/admin/layout.tsx>), [편집 route](<../../../../src/app/(admin)/admin/edit/[slug]/page.tsx>): 같은 앱의 `/admin/albums`, `/admin/songs`, `/admin/edit/[slug]`; `/admin-login`도 같은 앱                                                                    |
| E03 인증               | [auth.ts](../../../../src/auth.ts), [authentication-service](../../../../src/server/services/authentication-service.ts): Auth.js `5.0.0-beta.32`, Credentials, Argon2id, JWT. callback은 `sub`만 보존. 로그인은 ACTIVE 확인                                                                    |
| E04 인가               | [request-context](../../../../src/server/auth/request-context.ts), [ability](../../../../src/server/auth/ability.ts), [song-service](../../../../src/server/services/song-service.ts): 요청마다 DB role/status를 읽고 CASL 생성. service의 `requireAdmin`이 인증·`manage all` 확인             |
| E05 API                | [lyrics PATCH](../../../../src/app/api/admin/songs/[id]/lyrics/route.ts), [HTTP boundary](../../../../src/server/http/api-response.ts), [song browser API](../../../../src/entities/song/api/api.ts): Query → Ky → Route → Service → Repository. request/response Zod, 실패만 error envelope   |
| E06 DB                 | [schema](../../../../src/server/db/schema.ts): `Album`, `Song`, `account`, `profile`, `password_credential`, 이메일 인증 challenge/counter. `Song`은 `lyrics jsonb`, `youtubeId`, `hasOfficialCheer` 소유                                                                                      |
| E07 Song 관계          | [song-repository](../../../../src/server/repositories/song-repository.ts), `saveSongLyrics`: 한 Song에 가사 JSON 하나를 덮어씀. Album FK cascade, Song slug unique, service는 non-null slug 변경 거절                                                                                          |
| E08 content 계약       | [song contract](../../../../src/shared/contracts/song.ts): `LyricLine.startTime` 초, `segments[].text/isCheer/isEcho/startTimeOffset`, `isExtra`; line/segment ID와 종료 시간 없음                                                                                                             |
| E09 공개 범위          | `getSongDetailBySlug`/`mapSongDetail`: Song·Album visible, title/slug/youtubeId 확인. 보관 lyrics 파싱 실패는 계약 오류. [visibility tests](../../../../src/server/repositories/public-visibility.test.ts) 존재                                                                                |
| E10 편집 model         | [useLyricsEditor](../../../../src/features/manage-lyrics/model/useLyricsEditor.ts), [useAdminEditor](../../../../src/features/manage-lyrics/model/useAdminEditor.ts): LRC import, 캡처, 녹화 자동 다음 행, extra/segment 추가, Undo/Redo 50개, global/row offset. 캡처는 소수 둘째 자리 반올림 |
| E11 편집 UI            | [LyricsEditorClient](../../../../src/features/manage-lyrics/ui/LyricsEditorClient.tsx): Q/W/E/R, YouTube와 표, responsive panels. [preview](../../../../src/features/manage-lyrics/ui/LyricsTimelinePreview.tsx)는 GSAP로 150 px/s 이동하는 읽기용 rail                                        |
| E12 재생               | [YouTubePlayer](../../../../src/shared/ui/YouTubePlayer.tsx): IFrame Player API, requestAnimationFrame으로 currentTime 전달. `useAdWatcher`로 광고 중 timing update 차단                                                                                                                       |
| E13 저장/cache         | [AdminLyricsEditor](<../../../../src/app/(admin)/admin/edit/[slug]/_ui/AdminLyricsEditor.tsx>): Query mutation 성공 시 adminList invalidate; editor 초기값은 RSC props                                                                                                                         |
| E14 Docker/local       | [Dockerfile](../../../../Dockerfile), [compose.dev.yml](../../../../compose.dev.yml): Node 22.16.0 standalone image, 비root node. local Compose PostgreSQL 17 + Next                                                                                                                           |
| E15 원격 runtime       | [compose.oci-development.yml](../../../../compose.oci-development.yml): `app` 하나, loopback port, external DB network, digest image, env file, log rotation                                                                                                                                   |
| E16 CI/CD              | [.github/workflows/verify.yml](../../../../.github/workflows/verify.yml), [ops README](../../../../ops/oci/README.md): PR 검증, migration_develop push에서 ARM64 image → OCIR digest → GitHub Actions OCI Run Command → host deploy/health/smoke/rollback                                      |
| E17 storage/connection | [DB singleton](../../../../src/server/db/index.ts): process당 max 10 connections. [R2 upload](../../../../src/server/storage/upload-public-asset.ts)와 관리자 route-local [Server Action](<../../../../src/app/(admin)/admin/albums/_lib/upload-album-image-action.ts>) 존재                   |
| E18 email              | [OTP service](../../../../src/server/services/email-verification-service.ts), [delivery](../../../../src/server/email/oci-email-delivery.ts): 회원가입용 challenge, PostgreSQL 원자 counter, OCI Email Delivery                                                                                |

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
현재는 비밀번호로 로그인한 ADMIN과 TOTP를 마친 ADMIN을 구분하지 않는다.

## 3. 기준 커밋의 명세와 코드 차이

| 근거                                                                                             | 명세                                                                           | 코드에서 확인한 상태                                                                            |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| [Domain §8, §14](../../DOMAIN_SPECIFICATION.md)                                                  | FAN/FESTIVAL, UNIQUE(song, mode), 공식 잠금·공연 추천                          | guide 모델은 없고 Song의 nullable hasOfficialCheer만 존재                                       |
| Domain §10, §21, §23                                                                             | APPROVED 불변, 활성 revision 제한, Cue는 revision 소속                         | Song.lyrics를 덮어쓰며 revision/승인/Cue 테이블 없음                                            |
| Domain §20                                                                                       | source 임시 처리, 원본 영구 저장 금지, YouTube는 재생/참조, Python Worker 가정 | YouTube 재생만 구현. source acquisition/분석/worker 없음                                        |
| Domain AUTH-006 / [Auth §29](../../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md) | Domain은 인증 정보 변경 등에 회수 요구, Auth v1은 세션별 회수 미도입           | JWT sub만 보존. Console MFA 및 별도 회수 구현 없음                                              |
| [Form §4](../../oioi-bwg-architecture-clean-v1/08-form-state-architecture.md) / E10              | RHF가 form draft 소유                                                          | 기존 lyrics editor는 useState가 draft/history 소유                                              |
| 헌법 §4, 배포 §21 / E16                                                                          | OCI DevOps가 CD 소유                                                           | GitHub Actions direct Run Command 사용. [M9 기록](../M9-ZERO-EXTRA-COST-CD.md)에 변경 근거 존재 |

이 표는 pinned source의 차이만 기록한다. 최신 제품 요구·변경안은 [DESIGN](DESIGN.md)이 소유하며
이 문서의 코드 사실이 active SSOT를 대체하지 않는다. M7 DATA finding의 결과를 재작성하지 않는다.

## 4. 확인하지 않은 사실

실제 곡 수·JSON 이상치·분류 분포·영상 이용 범위, production DNS/Caddy/VM 자원, 편집 소요 시간·정확도·bundle 증가는
조회하거나 측정하지 않았다. repository 설정과 공식 문서만으로 운영 상태·데이터 전환 성공률·성능을 확정하지 않는다.

## 5. 조사 이력

실행한 read-only 조사는 `git status`, `git rev-parse`, `git log`, `git fetch`, `rg`, 파일 읽기 및
공식 웹 문서 확인이다. application 실행·DB 접속·schema migration·오디오 분석·성능 벤치마크는 하지 않았다.
문서 내용/링크 검증과 push hook 결과는 이 변경의 PR에 별도 기록한다.
