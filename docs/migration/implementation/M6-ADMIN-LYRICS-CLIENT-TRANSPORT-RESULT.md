# M6 관리자 Lyrics client transport 전환 결과

## 완료 범위

- `PATCH /api/admin/songs/[id]/lyrics`에 구조화된 lyrics·YouTube ID 저장 계약을 추가했다.
- Route Handler가 path/body를 검증하고 Song service가 인증·인가 및 not-found 판정을 유지한다.
- `entities/song` browser API와 mutation option이 새 endpoint를 호출하고 응답 식별자를 검증한다.
- route-private 조합 컴포넌트가 Ability와 mutation을 lazy lyric editor에 연결한다.
- 403 발생 시 Ability query를 다시 조회해 editor 노출 상태를 self-heal한다.
- feature 저장 결과를 `{ success, error }`에서 Promise rejection 기반으로 전환했다.
- lyric editor의 Server Action `save-song-data.ts`를 제거했다.

## 경계 결정

```text
RSC → 최소 editor DTO + serialized Ability
  → lazy lyric editor → Entity mutation → ky
  → PATCH /api/admin/songs/[id]/lyrics → Song service → repository
```

큰 editor bundle의 기존 lazy loading은 유지했다. Editor의 lyrics는 편집 draft이므로 별도 GET Query를
추가하지 않고 RSC가 읽은 최소 DTO로 초기화한다. production DB와 공개 Song cache 정책은 변경하지 않았다.

## 검증

- `pnpm type-check`: 통과
- `pnpm test:harness`: 7개 통과
- `pnpm lint`: 오류 없음, 기존 `max-lines-per-function` 경고 5건
- `pnpm lint:fsd`: 통과
- `pnpm test:unit:run`: 31 files, 95 tests 통과
- `pnpm format:check`: 통과
- `pnpm build`: 통과, 신규 lyrics route 확인
