# M6 관리자 Mutation API 전환 계획

## 목적

기존 관리자 앨범·곡 Server Action을 다음의 단일 mutation 경로로 전환한다.

```text
Admin Client
  → TanStack Query mutation
  → ky
  → /api/admin/* Route Handler
  → server service
  → repository
  → PostgreSQL
```

M5에서 적용한 `RequestContext`와 CASL service security boundary를 재사용한다. Route Handler나
client UI의 검사만으로 write 권한을 보장하지 않는다.

## 현재 inventory

| 영역 | 현재 delivery adapter | service | 전환 대상 |
| --- | --- | --- | --- |
| Album create/update/delete | `app/(admin)/admin/_lib/album-actions.ts` | `createAlbum` / `editAlbum` / `deleteAlbum` | `/api/admin/albums` 및 `/api/admin/albums/[id]` |
| Song create/update/delete | `app/(admin)/admin/_lib/song-actions.ts` | `createSong` / `editSong` / `deleteSong` | `/api/admin/songs` 및 `/api/admin/songs/[id]` |
| Song lyric save | route-local Server Action | `saveSongLyrics` | song update contract와 병합 여부를 별도 판단 |

현재 Server Action은 Zod parse, LRC parse, error string 변환, `router.refresh()` 기반 갱신을 함께
소유한다. 이는 M4 이후의 HTTP/`ApiError`/Query invalidation 계약과 병행하지 않는다.

## 확정 원칙

- request body와 path param은 Route Handler에서 Zod로 한 번 검증한다.
- 성공 생성은 `201`, update/delete는 실제 response DTO 또는 `204`를 명시적으로 선택한다.
- service는 `RequestContext`를 받고 `UNAUTHENTICATED`/`FORBIDDEN`을 유지한다.
- client는 `ApiError.code`로 401/403을 처리하며, 403은 ability 재조회 후 UI를 self-heal한다.
- Server Action의 `{ success, error }` result 관례와 `console.error` 기반 error 변환은 새 경로에
  복제하지 않는다.
- Query mutation 성공 후 관련 admin query key를 명시적으로 invalidate한다. `router.refresh()`와
  Next Data Cache invalidation을 대체 수단으로 사용하지 않는다.
- production DB migration, revision/discussion/moderation lifecycle, UI foundation(Base UI) 전환은 이
  API 전환 PR에 넣지 않는다.

## Frontend 배치와 구현 형태

`02-frontend-architecture.md`에 따라 Album 관리가 현재 `/admin/albums` 한 route의 단일 use-case인
동안 browser API adapter는 `features/manage-album/api`에 둔다. 여러 consumer가 공유하는 안정된
Album browser contract가 확인되기 전에는 `entities/album/api`로 미리 승격하지 않는다.

다만 `ui`는 API endpoint, ky, Query cache policy를 직접 알지 않는다. 기존
`AlbumManagerClient`의 검색·dialog 같은 presentation state는 UI에 남기고, admin 목록 acquisition,
mutation, invalidation, 403 ability 재조회는 실제 application behavior를 표현하는
`features/manage-album/model/use-album-manager.ts`가 조립한다. TanStack Query의 `useQuery`와
`useMutation`은 이 hook에서 감추지 않고 그대로 사용한다.

```text
app/(admin)/admin/albums/page.tsx
  ├─ RSC → listAdminAlbums(ctx) → Query cache seed / HydrationBoundary
  └─ AlbumManagerClient (ui)
       └─ useAlbumManager (model)
            ├─ useQuery(adminAlbumQueries.list())
            ├─ useMutation(adminAlbumMutations.create/update/delete())
            ├─ invalidateQueries(adminAlbumQueries.list().queryKey)
            └─ 403 → ability refetch

features/manage-album/api
  └─ ky → /api/admin/albums Route Handler
```

mutation invalidation은 client가 같은 query key의 `useQuery`로 admin 목록을 소비한 뒤에만 적용한다.
따라서 Album 전환은 write API만 추가하지 않고 admin list `GET /api/admin/albums`와 query option도 같은
delivery 전환 단위에 포함한다.

### 계약·Route Handler 예시

```ts
// src/shared/contracts/admin-album.ts
export const saveAdminAlbumSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  imgUrl: z.url(),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
  releaseDate: z.string().nullable(),
  isVisible: z.boolean(),
});
```

```ts
// src/app/api/admin/albums/route.ts
export async function POST(request: Request) {
  try {
    const input = saveAdminAlbumSchema.parse(await request.json());
    const album = await createAlbum(await getRequestContext(), input);

    return jsonResponse(adminAlbumSchema, toAdminAlbumDto(album), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

### Feature API·model 예시

```ts
// src/features/manage-album/api/admin-album-api.ts
export async function getAdminAlbums() {
  return parseClientResponse(adminAlbumListSchema, await http.get("/api/admin/albums"));
}

export const adminAlbumQueries = {
  list: () =>
    queryOptions({
      queryKey: ["admin", "albums"] as const,
      queryFn: getAdminAlbums,
    }),
};
```

```ts
// src/features/manage-album/model/use-album-manager.ts
export function useAlbumManager() {
  const queryClient = useQueryClient();
  const albums = useQuery(adminAlbumQueries.list());
  const create = useMutation({
    ...adminAlbumMutations.create(),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: adminAlbumQueries.list().queryKey,
      }),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 403) refetchAbility();
    },
  });

  return { albums, create };
}
```

위 코드는 구조 예시다. 실제 구현에서 `refetchAbility()`의 정확한 consumer API와 response DTO mapper는
현재 auth feature·service projection에 맞춰 확정한다. UI의 props는 model이 제공하는 DTO와 event
callback으로 제한하며 `http`, `ApiError`, `QueryClient`를 전달하지 않는다.

## PR 분할 순서

1. **이 PR — mutation API 계획**: 현재 Server Action·service·client 연결을 기록하고 route/contract
   분할을 고정한다.
2. **Album HTTP contract + Route Handler**: admin list GET와 create/update/delete input·response contract,
   path param, 401/403/validation/expected error test를 추가한다. 기존 Server Action consumer는 유지한다.
3. **Album client transport 전환**: RSC seed와 client `useQuery`를 같은 query key로 연결하고, album
   manager model에서 ky/TanStack Query mutation, query invalidation, 403 ability revalidation을 적용한
   뒤 album Server Action을 제거한다.
4. **Song mutation contract + Route Handler**: LRC parsing의 service 소유 경계를 정리한 뒤 song
   create/update/delete API와 테스트를 추가한다.
5. **Song client transport 전환**: song manager 및 lyric editor consumer를 전환하고 기존 Server Action을
   제거한다.

Album과 Song을 한 PR에 함께 전환하지 않는다. Song의 LRC parsing과 lyric editor는 별도 reviewable
concern이다.

## 구현 전 확인 항목

- Album/Song delete의 not-found 및 FK conflict 공개 error code가 기존 `AppError` 계약에 충분한지
  확인한다. 부족하면 먼저 API/Error 계약을 작은 변경으로 확장한다.
- 현재 admin read query key와 manager hydration 범위를 확인해 mutation invalidation target을 정한다.
- client Ability의 403 self-healing은 최초 Album transport 전환에서 실제 `ApiError` consumer와 함께
  적용한다. 별도 추상화나 전역 retry hook은 만들지 않는다.

## 비범위 및 보류

- OCI Compute 배포 및 Instance Principal 실발송 smoke
- isolated PostgreSQL integration test lifecycle 및 CI service container(M7)
- 일반 사용자 회원가입 UI와 자동 로그인 UX
- 관리자 template CMS
