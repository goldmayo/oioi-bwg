---
title: "M2 Entity Boundary Result"
document_id: "M2-ENTITY-BOUNDARY-RESULT"
version: "1.0"
status: "active"
authority: "result"
updated_at: "2026-08-29"
depends_on:
  - "M2-FSD-FULL-AUDIT"
---

# M2 Entity Boundary Result

## 완료한 조정

### `entities/album`

- `model/album.ts`: Album/AlbumSong view model
- `ui/AlbumCard.tsx`
- `ui/AlbumListItem.tsx`
- `ui/AlbumSongListItem.tsx`
- `ui/AlbumListSkeleton.tsx`
- `ui/TitleBadge.tsx`
- `index.ts` public API

Album 도메인 UI와 모델은 더 이상 `shared`에 두지 않는다. route와 feature는
`@/entities/album` public API를 사용한다.

### `entities/cheer-guide`

- `model/lyrics.ts`: Lyrics/Cheer Guide schema와 type
- `lib/lrc-parser.ts` 및 테스트
- `ui/OfficialBadge.tsx`
- `index.ts` public API

가사/응원법 관련 feature는 `@/entities/cheer-guide`를 사용한다.

### `features/manage-lyrics`

- `model/useLyricsEditor.ts` 및 테스트

가사 편집 상태와 undo/redo는 shared가 아니라 manage-lyrics use-case가 소유한다.

## 보류한 항목

- Drizzle schema/query/command 및 Supabase server client는 M3 server foundation에서 이동
- DTO와 정식 DOMAIN_SPECIFICATION entity contract는 M3~M4에서 정의
- `useAdWatcher`, `youtube`는 실제 cross-feature reuse를 유지하며 후속 재평가
- 미사용 `ThemeToggle`, `Feature`는 별도 dead-code 결정으로 분리

## 검증

- `pnpm type-check`: PASS
- `pnpm test:harness`: PASS — 7 tests
- `pnpm lint:fsd`: PASS
- `pnpm lint`: PASS — 0 errors, 4 existing function-length warnings

## 다음 단계

M2에서 남은 구조 변경은 서버 직접 접근의 handoff 확인뿐이다. 다음 코드 단계는 M3의
`src/server/db`, `repositories`, `services` 경계 정착이다.
