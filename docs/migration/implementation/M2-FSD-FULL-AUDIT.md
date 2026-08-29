---
title: "M2 FSD Full Audit"
document_id: "M2-FSD-FULL-AUDIT"
version: "1.0"
status: "review"
authority: "evidence"
updated_at: "2026-08-29"
depends_on:
  - "M2-ROUTE-INVENTORY"
  - "M2-HANDOFF"
---

# M2 FSD Full Audit

## 판정 기준

분류는 consumer 수가 아니라 다음 우선순위로 판정한다.

1. `app`: route, layout, metadata, route composition
2. `widgets`: 여러 route에서 재사용되는 완성 화면 단위
3. `features`: 사용자 행동/use-case와 interaction
4. `entities`: Album, Song, Lyrics/Cheer Guide 같은 도메인 개념과 도메인 UI
5. `shared`: 도메인 의미 없이 재사용 가능한 primitive UI, 순수 utility, framework 기반 코드
6. `server`: DB, repository, service, auth/authz, HTTP 경계

헌법 01 §7의 route-local first는 route composition의 기본값이다. 도메인 의미가 확인된
컴포넌트를 `shared`에 유지하는 근거로 사용하지 않는다.

## 잘못 분류된 항목

| 현재 위치 | 문제 | 목표 ownership | 단계 |
|---|---|---|---|
| `shared/model/album.ts` | Album/Song 도메인 view model | `entities/album/model`, `entities/song/model` | M2→M4 |
| `shared/model/lyrics.ts` | Cheer Guide/Lyrics domain schema | `entities/cheer-guide/model` | M3→M4 |
| `shared/ui/album/AlbumListItem.tsx` | Album aggregate와 곡 목록을 표현 | `entities/album/ui` | M2 |
| `shared/ui/album/AlbumSongListItem.tsx` | Song 도메인과 상세 route를 표현 | `entities/song/ui` | M2 |
| `shared/ui/album/AlbumListSkeleton.tsx` | Album list 전용 loading composition | `entities/album/ui` 또는 route-local | M2 |
| `src/app/(user)/_ui/album-card.tsx` | Album 도메인 UI인데 route-local로만 이관됨 | `entities/album/ui` | M2 |
| `shared/ui/TitleBadge.tsx` | 타이틀곡이라는 Song 도메인 의미 | `entities/song/ui` | M2 |
| `shared/ui/OfficialBadge.tsx` | 공식 응원법이라는 Cheer Guide 의미 | `entities/cheer-guide/ui` | M2 |
| `shared/lib/lrc-parser.ts` | Lyrics/Cheer Guide 형식 해석 | `entities/cheer-guide/lib` | M3/M4 |
| `shared/model/useLyricsEditor.ts` | 가사 편집 use-case 전용 상태 | `features/manage-lyrics/model` | M2 |

## 조건부 검토 항목

| 현재 위치 | 판정 | 이유 |
|---|---|---|
| `features/album-info/*` | feature/widget 경계 재검토 | 모달 interaction은 feature지만 표시 모델은 Album entity를 사용해야 함 |
| `features/chant-sync/*` | feature 유지 | 재생·가사 동기화라는 사용자 use-case를 소유함 |
| `shared/model/useAdWatcher.ts` | M3 전 유지, 이후 분리 검토 | YouTube 광고 감지라는 특정 interaction이지만 두 feature에서 공유됨 |
| `shared/model/youtube.ts` | shared 후보 | 외부 YouTube SDK 최소 타입이며 도메인 의미가 없음 |
| `shared/ui/YoutubePlayer.tsx` | shared 후보 | 외부 미디어 primitive. chant feature 전용으로 확정되면 이동 |
| `shared/lib/analytics.ts` | shared 후보 | telemetry infrastructure이나 이벤트 이름은 도메인별 adapter 분리 검토 |
| `shared/ui/more/*` | shared 유지 가능 | more route 여러 페이지에서 실제 재사용되는 navigation/presentation |
| `shared/ui/navigation/*` | shared 유지 | user layout 공통 navigation |

## 서버 경계 위반(구조상 보류가 아닌 미해결)

다음은 M2에서 이동하지 않지만, 현재 구조가 올바르다는 뜻은 아니다.

- `src/app/**/page.tsx`가 `src/shared/api/db/drizzle/queries`를 직접 호출
- `features/manage-content/api/actions.ts`가 Drizzle schema와 DB를 직접 조작
- `features/manage-lyrics/api/actions.ts`가 persistence command를 직접 호출
- `features/auth/api/actions.ts`와 admin layout이 Supabase server client를 직접 호출
- Drizzle schema inferred type이 feature UI props로 직접 전달됨

M3에서 `src/server/db`, `repositories`, `services`로 이동하고 M4에서 DTO/Route Handler/ky를
도입한다. 이것은 M2에서 무시할 항목이 아니라 M2 handoff로 넘기는 미해결 항목이다.

## 미사용 코드 후보

- `shared/ui/theme-toggle.tsx`: source consumer 0개
- `shared/ui/Feature.tsx`: JSX consumer 0개이며 현재 feature flag wrapper는 사용되지 않음

제품 요구 확인 없이 이번 entity 이동과 함께 삭제하지 않는다. 별도 dead-code 확인 checkpoint에서
삭제 또는 보존을 결정한다.

## 결론

현재 M2 구조는 route-local과 feature/shared segment는 일부 정리됐지만, Album/Song/Lyrics
도메인 UI와 model이 `shared`에 남아 있어 top-down FSD 기준으로 완료 상태가 아니다.

다음 코드 작업의 우선순위는 다음과 같다.

1. `entities/album`, `entities/song`, `entities/cheer-guide`의 최소 slice와 public API 생성
2. 도메인 UI/model import를 entity public API로 교체
3. `useLyricsEditor`를 `features/manage-lyrics/model`로 이동
4. M2 결과 문서와 하네스에 entity ownership 규칙/검사를 반영
5. 이후 M3에서 server boundary 이동 시작
