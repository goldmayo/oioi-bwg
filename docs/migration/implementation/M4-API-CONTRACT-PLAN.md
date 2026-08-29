# M4 API Contract Plan

## Goal

Client server-state의 HTTP boundary를 `TanStack Query → ky → Route Handler → service`로
정착시킨다. RSC의 공개 페이지와 server service 직접 호출은 유지하며, HTTP를 강제하지 않는다.

## Completed public-read checkpoint

1. `shared/contracts`에 failure, 공개 album, 공개 song response의 Zod schema와 type을 둔다.
2. 기존 lyric schema의 canonical owner를 `shared/contracts/song.ts`로 옮기고 entity는 public
   compatibility re-export만 유지한다.
3. `GET /api/albums/[slug]`, `GET /api/songs/[slug]` Route Handler가 contract를 경계에서
   검증하여 반환한다.
4. entity API adapter는 Ky `http` method와 Query option에서 이 contract를 소비하며 Query
   `signal`을 전달한다.

## Ky guardrails

- non-2xx는 Ky의 HTTP error path에서 `ApiError`로 정규화한다. `throwHttpErrors: false`를 쓰지 않는다.
- 2xx와 failure JSON 모두 `unknown`에서 시작해 Zod로 검증한다.
- transport retry는 기본으로 끄거나 최소화하고 Query lifecycle retry는 TanStack Query가 소유한다.
- Query `signal`을 Ky request로 그대로 전달한다.
- M5 auth 경계 이전에는 token refresh/retry와 authorization header hook을 도입하지 않는다.
- waveform source 등 대용량 file transfer는 일반 JSON Ky client의 범위가 아니다.

## Deliberately out of scope

- M5 authentication / CASL authorization
- admin mutation contract와 revision, discussion, moderation lifecycle
- waveform upload protocol
- Route URL 또는 locale routing 변경
