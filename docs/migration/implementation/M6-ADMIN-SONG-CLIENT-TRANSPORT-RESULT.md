# M6 관리자 Song client transport 전환 결과

## 완료 범위

- `entities/song/api`에 관리자 목록 Query와 create/update/delete Mutation options를 추가했다.
- Song RSC seed와 Client Query가 query-key factory의 동일 key를 공유한다.
- 관리자 곡 페이지가 Song·Album·Ability DTO를 request별 QueryClient에 seed하고 가까운 subtree만 hydrate한다.
- Song manager가 Server Action/local state/reload 대신 TanStack Query mutation과 명시적 목록 invalidation을 사용한다.
- 403 mutation failure는 Ability query를 invalidate하여 관리자 UI를 self-heal한다.
- 곡 CRUD용 `song-actions.ts`와 action 전용 feature type을 제거했다.

## 경계와 후속 작업

```text
Song manager → entities/song Query·Mutation → ky → Route Handler → service
```

구조화된 가사 편집기는 LRC 원문 CRUD와 다른 request contract를 사용하므로 이번 PR에 합치지 않았다.
다음 PR에서 전용 lyrics 저장 endpoint와 mutation을 추가한 뒤 `save-song-data.ts`를 제거한다.

운영 DB, `Song.slug` constraint, revision/discussion/moderation lifecycle은 변경하지 않았다.

## 검증

- `pnpm type-check`: 통과
- `pnpm test:harness`: 7개 통과
- `pnpm lint`: 오류 없음, 기존 `max-lines-per-function` 경고 5건
- `pnpm lint:fsd`: 통과
- `pnpm test:unit:run`: 30 files, 92 tests 통과
- `pnpm format:check`: 통과
- `pnpm build`: 통과
