# 데이터 페칭(Data Fetching) 및 조작(Mutation) 아키텍처 전략

본 문서는 프로젝트 내에서 `@tanstack/react-query`와 FSD(Feature-Sliced Design) 패턴을 결합하여, **단일 진실 공급원(SSOT)**을 확립하고 **응집도(Cohesion)**를 극대화하기 위한 아키텍처 설계 지침입니다. TkDodo의 베스트 프랙티스에 기반을 둡니다.

---

## 1. 근본 원칙 (Separation of Concerns)

> **"조회(Queries)는 순수 Fetch, 조작(Mutations)은 Server Action 기반 커스텀 훅"**

- **조회 (GET):** 서버 액션을 사용하지 않고 순수 HTTP Fetch(`api.get`)를 사용하여 브라우저 및 CDN 캐싱 이점을 극대화합니다.
- **조작 (POST/PUT/DELETE):** 폼 데이터 처리 및 보안 강화를 위해 Server Action을 활용하며, React Query의 `useMutation`으로 감싸 캐시 무효화를 연동합니다.

---

## 2. 구조적 분리 (FSD 적용)

조회와 조작은 앱 내에서 가지는 생명주기와 성격이 완전히 다릅니다. 이 둘을 한 파일(`mutations.ts`)에 몰아넣는 안티패턴을 방지하고 FSD 원칙을 적용합니다.

### 2.1 조회 (Query) = Model / Entity 계층
조회 로직은 여러 페이지와 피처에서 공통으로 재사용되므로 도메인 단위(`src/models`)에 위치시킵니다. `queryOptions`를 활용한 팩토리 패턴을 사용하여 SSR(`prefetchQuery`)과 CSR(`useQuery`) 간에 완벽히 옵션을 공유합니다.

```text
src/
 ┗ models/
    ┗ song/
       ┣ types.ts            # DTO (e.g., Song, SongDetail)
       ┗ queries.ts          # songKeys, songQueries (queryOptions 팩토리)
```

**`src/models/song/queries.ts` 예시:**
```typescript
import { queryOptions } from '@tanstack/react-query';
import { api } from '@/shared/api/http/base-api';

export const songKeys = {
  all: ['songs'] as const,
  lists: () => [...songKeys.all, 'list'] as const,
  detail: (id: string) => [...songKeys.all, 'detail', id] as const,
};

export const songQueries = {
  list: () => queryOptions({
    queryKey: songKeys.lists(),
    queryFn: ({ signal }) => api.get('/songs', { signal }),
  }),
};
```

### 2.2 조작 (Mutation) = Feature 계층 ⭐️ 핵심
조작 로직은 특정 버튼 클릭, 폼 제출 등 **UI 액션에 종속**됩니다. 따라서 도메인 폴더가 아닌, 특정 비즈니스 흐름을 담당하는 `src/features/` 안의 개별 파일로 분리하여 응집도를 극대화합니다.

```text
src/
 ┗ features/
    ┣ manage-content/
    ┃  ┣ api/
    ┃  ┃  ┣ useCreateSong.ts # 노래 추가 Mutation 훅 (단일 파일)
    ┃  ┃  ┗ useDeleteSong.ts # 노래 삭제 Mutation 훅 (단일 파일)
    ┃  ┗ ui/
    ┃     ┗ CreateSongForm.tsx # 폼 UI (동일 폴더의 api 훅 사용)
    ┃
    ┗ like-song/
       ┣ api/
       ┃  ┗ useLikeSong.ts   # 좋아요 Mutation 훅 (단일 파일)
       ┗ ui/
          ┗ LikeButton.tsx
```

**`src/features/manage-content/api/useCreateSong.ts` 예시:**
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { songKeys } from '@/models/song/queries';
import { createSongAction } from '../actions'; // 서버 액션

export const useCreateSong = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Server Action 호출
    mutationFn: async (data: SongCreateDTO) => {
      const result = await createSongAction(data);
      if (!result.success) throw new Error(result.message);
      return result.data;
    },
    
    // 조작 성공 시, Model(Entity) 계층의 Key를 참조하여 캐시 무효화
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: songKeys.lists() });
    },
  });
};
```

---

## 3. 구조적 이점 요약

1. **파일 크기 감소 및 복잡도 하락:** `mutations.ts`가 거대해지는 괴물 파일(God File) 현상을 완벽히 방지합니다.
2. **높은 응집도 (High Cohesion):** `CreateSongForm.tsx`와 `useCreateSong.ts`가 같은 폴더에 위치하여 개발 시 탭 이동을 최소화하고 관련된 로직을 직관적으로 파악할 수 있습니다.
3. **단방향 의존성 유지 (Feature ➡️ Model):** Feature 계층의 Mutation 훅이 Model 계층의 `songKeys`를 참조하는 올바른 의존성 흐름이 자연스럽게 형성됩니다.

---

## 4. SSR 및 Hydration 전략 (Next.js App Router)

Next.js 환경에서 상태 오염(State Leakage) 없이 안전하게 데이터를 미리 가져와(Prefetching) 클라이언트에 공급(Hydration)하기 위한 표준 패턴입니다.

### 4.1 QueryClient 인스턴스 분리 (State Leakage 방지)
서버(SSR) 환경에서는 다수의 사용자가 런타임을 공유하므로, 전역 싱글톤으로 `QueryClient`를 만들면 A 유저의 개인정보 캐시가 B 유저에게 노출되는 **상태 오염(State Leakage)**이 발생합니다. 
이를 완벽히 방지하기 위해 서버에서는 매 요청마다 독립적인 인스턴스를 만들고, 브라우저에서는 싱글톤을 유지하는 패턴을 사용합니다.

```typescript
// src/shared/libs/react-query/query-client.ts
import { QueryClient, isServer } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // SSR 환경에서는 staleTime을 0보다 크게 설정하여,
        // 클라이언트에서 마운트되자마자 불필요한 refetch가 발생하는 것을 방지합니다.
        staleTime: 60 * 1000, 
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (isServer) {
    // 서버: 요청이 들어올 때마다 깨끗한 새 캐시 인스턴스 생성 (격리)
    return makeQueryClient();
  } else {
    // 클라이언트: 초기화 후 싱글톤 유지 (페이지 이동 시 캐시 유지)
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}
```

### 4.2 전역 Provider 설정 (`providers.tsx`)
앱의 최상단에는 **오직 `<QueryClientProvider>`(또는 래퍼인 `<QueryProvider>`)만 존재**해야 합니다. `layout.tsx`나 `providers.tsx` 레벨에서 앱 전체를 `<HydrationBoundary>`로 감싸는 것은 매우 심각한 성능 저하와 캐시 오염을 유발하는 안티패턴입니다.

**왜 안티패턴인가요?**
전역으로 Hydration을 수행하게 되면, 특정 페이지에서만 필요한 서버 사이드 캐시 데이터가 **앱 전체의 생명주기에 결합**됩니다. 페이지를 이동할 때마다 거대한 캐시 객체가 불필요하게 직렬화/역직렬화되어 클라이언트로 내려가게 되며, 이는 엄청난 네트워크 낭비와 브라우저 메모리 누수로 직결됩니다.

```tsx
// ❌ 안티패턴: 전역 레이아웃이나 프로바이더에서 Hydration 수행
export function BadProviders({ children, dehydratedState }) {
  return (
    <QueryProvider>
      {/* 
        모든 페이지의 데이터가 이곳을 거치게 되어,
        A페이지의 캐시가 B페이지로 불필요하게 넘어가고 메모리를 차지합니다.
      */}
      <HydrationBoundary state={dehydratedState}>
        {children}
      </HydrationBoundary>
    </QueryProvider>
  )
}

// ✅ 베스트 프랙티스: 순수하게 QueryClient 환경만 제공 (Hydration은 필요한 페이지에서만!)
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider attribute="class" defaultTheme="dark">
        {children}
      </ThemeProvider>
    </QueryProvider>
  );
}
```

### 4.2 페이지 단위 Prefetching (Server Component)
서버에서 렌더링하기 전 데이터를 미리 가져오고 싶은 특정 페이지나 레이아웃에서만 `HydrationBoundary`를 적용합니다. 이때 Model 계층의 `queryOptions` 팩토리를 재사용합니다.

```tsx
// app/songs/page.tsx
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/shared/libs/react-query/query-client";
import { songQueries } from "@/models/song/queries"; // SSOT 재사용

export default async function SongsPage() {
  // 1. 서버 전용 QueryClient 인스턴스 생성 (요청당 독립 생성으로 State Leakage 완벽 방지)
  const queryClient = getQueryClient();
  
  // 2. 서버에서 데이터 사전 페칭 (내부의 API Fetch가 동작)
  await queryClient.prefetchQuery(songQueries.list());

  return (
    // 3. 패칭된 캐시 데이터를 직렬화하여 클라이언트로 공급
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SongList />
    </HydrationBoundary>
  );
}
```

### 4.3 데이터 소비 (Client Component)
서버에서 성공적으로 Hydration을 마쳤다면, 클라이언트 컴포넌트는 깜빡임(로딩 스피너) 없이 즉시 데이터를 소비합니다. React Query v5부터는 `useSuspenseQuery` 사용을 권장합니다.

```tsx
"use client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { songQueries } from "@/models/song/queries";

export function SongList() {
  // SSR에서 이미 데이터를 가져왔으므로, 클라이언트 마운트 즉시 data가 보장됩니다!
  // 데이터가 undefined일 수 없으므로 타입 가드가 불필요합니다.
  const { data } = useSuspenseQuery(songQueries.list());

  return <div>{data.title}</div>;
}
```

### 💡 실무 팁 (Prefetching 선택 기준)
SEO가 중요하지 않거나 갱신 빈도가 매우 높은 **유저 개인화 데이터**의 경우, 굳이 서버에서 `prefetchQuery`를 억지로 수행하지 마세요. 클라이언트 컴포넌트에서 곧바로 `useSuspenseQuery`로 호출하는 편이 HTML 응답 속도(TTFB)를 높이는 데 훨씬 유리할 수 있습니다.

---

## 5. 백엔드 분리 및 Server Action 마이그레이션 (BFF 패턴)

현재는 Next.js가 직접 DB를 조작하는 백엔드 역할을 하고 있지만, 추후 **독립된 백엔드 서버(Spring, Fastify 등)**로 분리되더라도 현재의 FSD 구조는 전혀 수정 없이 완벽하게 대응할 수 있습니다.

### 5.1 Server Action을 BFF(Backend For Frontend)로 활용
가장 추천하는 마이그레이션 방식은 브라우저가 직접 외부 백엔드를 호출하는 대신, 기존처럼 Next.js의 Server Action을 호출하고 **Server Action 내부에서 외부 백엔드 API를 호출(BFF)**하는 것입니다.

이때, 우리가 만들어둔 Isomorphic(Universal) HTTP 클라이언트인 `base-api`를 Server Action 내부에서 그대로 사용합니다.

```typescript
// src/features/manage-content/actions.ts (서버 액션 예시)
import { api } from '@/shared/api/http/base-api';

export async function createSongAction(data: SongCreateDTO) {
  try {
    // 💡 핵심: 클라이언트용 api 객체를 서버 액션(Node/Edge)에서 그대로 사용!
    // 쿠키 기반 서버사이드 토큰 자동 주입, 에러 파싱, 타임아웃 등이 완벽히 적용됩니다.
    const response = await api.post('/songs', { json: data }).json<SongDetailDTO>();
    
    return { success: true, data: response };
  } catch (error) {
    // API 호출 실패 시 우리가 규격화한 ServerError 등이 캐치됨
    return { success: false, message: error.message };
  }
}
```

### 5.2 완벽한 단일 책임 원칙 (SRP) 유지
이 구조의 가장 큰 장점은 백엔드 구조가 통째로 바뀌어도 **클라이언트 UI 코드가 단 한 줄도 변경되지 않는다**는 점입니다.

- **UI 컴포넌트:** `mutate(data)` 만 호출하며, 데이터 조작의 내부 구현체를 전혀 모릅니다.
- **Mutation 훅:** 캐시 무효화(`invalidateQueries`)와 쿼리 키 매핑만 담당합니다.
- **Server Action:** 실제 데이터 조작(DB 접근이든 외부 API Fetch든)만을 책임집니다.

따라서 백엔드가 아무리 바뀌어도 오직 Server Action 파일만 수정하면 되므로, 단일 책임 원칙(SRP)을 수호하는 가장 유연한 프론트엔드 아키텍처입니다.

---

## 6. 데이터 매퍼(Data Mapper) 아키텍처 통합

백엔드의 데이터 규격(DTO)과 프론트엔드 UI 렌더링에 필요한 데이터 형태(ViewModel)는 종종 불일치합니다. 이를 컴포넌트 내부에서 변환하면 UI 로직과 비즈니스 로직이 강하게 결합되어 유지보수성이 크게 떨어집니다. 
이를 방지하기 위해 **React Query의 `select` 옵션**을 활용하여 데이터 어댑터 계층을 구성합니다.

### 6.1 DTO ➡️ View Model 매핑 (조회 로직)
조회 시 백엔드의 스네이크 케이스 변수명이나 날 것의 ISO 날짜 포맷을 UI 친화적인 형태로 변환합니다. `queryOptions` 팩토리에 매퍼(Mapper) 함수를 통합하면, 컴포넌트는 항상 완벽하게 정제된 ViewModel 타입만 안전하게 전달받습니다.

```typescript
// src/models/song/mappers.ts
export const mapSongDtoToViewModel = (dto: SongDTO): SongViewModel => ({
  id: dto.id,
  title: dto.title,
  createdAt: new Date(dto.created_at).toLocaleDateString(), // UI용 포맷팅 변환
});

// src/models/song/queries.ts
import { queryOptions } from '@tanstack/react-query';
import { mapSongDtoToViewModel } from './mappers';

export const songQueries = {
  detail: (id: string) => queryOptions({
    queryKey: songKeys.detail(id),
    queryFn: ({ signal }) => api.get(`/songs/${id}`, { signal }).json<SongDTO>(),
    // 💡 핵심: API로 받아온 DTO를 select 옵션을 통해 즉시 ViewModel로 변환
    select: (data) => mapSongDtoToViewModel(data),
  }),
};
```
이 구조 덕분에 백엔드의 데이터 스키마가 갑자기 변경되더라도 `mappers.ts`만 수정하면 되며, 수십 개의 UI 컴포넌트를 일일이 수정할 필요가 없습니다.

### 6.2 FormSchema ➡️ DTO 매핑 (조작 로직)
유저가 입력한 폼(Form) 데이터를 서버로 보낼 때는, 조작을 담당하는 Feature 계층(Mutation 훅 내부 또는 직전)에서 역방향 매핑을 수행합니다.

```typescript
// src/features/manage-content/api/useCreateSong.ts
export const useCreateSong = () => {
  return useMutation({
    // mutationFn의 인자로 UI 컴포넌트의 Zod Form 스키마 타입이 들어옵니다.
    mutationFn: async (formValues: z.infer<typeof songFormSchema>) => {
      
      // 💡 핵심: 프론트엔드 Form 데이터를 서버가 요구하는 DTO 규격으로 변환
      const dto: SongCreateDTO = {
        title: formValues.title,
        created_at: new Date().toISOString(), // 스네이크 케이스 등 DTO 스펙에 맞춤
      };
      
      return await createSongAction(dto);
    },
    // ...
  });
};
```
