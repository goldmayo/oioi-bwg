# 🚀 Harmony Mosaic: Next Steps & Ticket List

본 문서는 오늘까지 완료된 주요 스프린트 내역과 향후 해결해야 할 후속 작업(티켓)들을 정리한 리스트입니다.

---

## 📅 오늘 완료한 작업 (Today's DONE)

- [x] **DB 스키마 정규화 및 마이그레이션**: 하드코딩된 `ALBUMS` 상수를 완전 제거하고, `Song` 테이블 컬럼을 정규화하여 `Album` 테이블과 외래키(`albumId`) 릴레이션으로 완벽하게 연동했습니다.
- [x] **데이터 엑세스 티어 100% 분리**: 프론트엔드용 뷰모델(`shared/types/album.ts`)과 백엔드 Drizzle 스키마를 철저히 분리하고, 조인 쿼리(`getAllAlbumsWithSongs`, `getAlbumBySlug`)를 모든 메인 UI와 사이드바에 연결했습니다.
- [x] **SSR 렌더링 병목 및 레이아웃 캐시 최적화**: 기술 블로그 수준의 `rendering_strategy.md` 문서 지침을 준수하여 메인 화면에 `"use cache";`를 적용해 무기한 캐싱 + SSG 급 응답 속도를 확보했습니다.
- [x] **Next.js `Image` 레이아웃 붕괴 (레터박스 버그) 해결**: 모달 내부 앨범 커버의 높이가 무너지며 찌그러지거나 잘리는 현상을 부모 요소와 CSS 레이아웃을 통해 최적화했습니다.
- [x] **Soft Navigation 유지 및 애니메이션 트레이드오프**: 앨범 모달을 닫을 때 벌어지는 '레이아웃 밀림(Shift)' 이슈를 분석하고, 선언적 `<Link>` 및 라우터 캐시를 적극 활용해 쾌적한 네비게이션 복원 경험을 만들어 냈습니다.

---

## 🛠️ 대기 중인 작업 티켓 (TO-DO Tickets)

### 1. [Feature] View Transition API 도입 (앨범 커버 모프 애니메이션)
- **설명**: 사용자가 메인 페이지의 그리드에서 앨범 커버를 클릭하면, 이미지가 부드럽게 날아와 모달 창의 대형 커버로 확장되는 `View Transition` 효과 적용.
- **체크리스트**:
  - `next-view-transitions` 라이브러리 설치 평가 혹은 순수 CSS `view-transition-name` 식별자 부착 정책 설계.
  - 그리드 썸네일과 앨범 모달 커버 간 동일한 Slug 기반 transition-name 매핑.

### 2. [Refactor] 어드민 패널 (Admin) 앨범 릴레이션 마이그레이션 마무리
- **설명**: 현재 관리자 페이지의 곡 추가/수정 폼(Admin Editor)이 여전히 기존의 단순 `albumName` 문자열 입력 방식에 묶여 있을 수 있습니다. 이를 `Album` 테이블을 참조하는 Select 형태나 `albumId` 기준으로 완벽하게 연결해야 합니다.
- **체크리스트**:
  - `useAdminEditor` 훅에서 앨범 목록을 불러와 Select Box로 제공.
  - 곡 Insert/Update 쿼리 수정. 

### 3. [Design/UX] 렌더링 시프트 및 스켈레톤 디자인 최종 방어선
- **설명**: 캐시 인프라를 잘 태워두었으나, 디바이스 해상도나 저사양 환경에서 컨테이너 높이 계산 지연이 발생할 것을 대비해 `docs/rendering_strategy.md`에서 언급한대로 약간의 Loading State나 Skeleton을 미세 컨트롤.
- **체크리스트**:
  - 앨범 상세 로딩/에러 컴포넌트 시각적 고도화.
  - Intercepting Routes (`@modal`) 적용의 필요성에 대해 아키텍처 관점에서 다시 한번 판단해보기.

### 4. [Test] 모바일 & 프로덕션 엣지 환경 테스트
- **설명**: 모바일 가로/세로 모드에서도 레이아웃이 무너지지 않는지 최종 검토. Cloudflare Workers 배포 환경에서 Next.js의 `"use cache"` 런타임 호환성 리스크 대비.



## Phase 1. 뼈대 공사: 글로벌 레이아웃 및 환경 통제 (Global Foundation)
 
 ### Task 1-1. 커스텀 훅 및 In-App 브라우저 가드 컴포넌트 생성
src/shared/hooks/useInAppBrowserOut.ts 구현 (카카오/안드로이드 대응)
UI가 없는 InAppBrowserGuard.tsx 작성
 
 ### Task 1-2. 루트 레이아웃에 가드 모듈 부착
src/app/layout.tsx 내에 InAppBrowserGuard 마운트 후 모바일 단말기 정상 탈출 테스트
 
 ### Task 1-3. 반응형 네비게이션 UI 컴포넌트 및 아이콘 제작
하단 고정 <BottomNav /> 컴포넌트 (fixed bottom-0 w-full md:hidden) 제작 (항목: 홈, 응원법, 검색, 더보기)
좌측 고정 <LNB /> 사이드바 컴포넌트 (fixed left-0 h-screen w-64 hidden md:flex) 제작
 
 ### Task 1-4. User 메인 레이아웃 적용 및 패딩 조정
src/app/(user)/layout.tsx에 위 두 네비게이션을 배치
네비게이션이 콘텐츠를 가리지 않도록 <main className="pb-16 md:pl-64"> 등의 공통 반응형 여백(Padding) 세팅

## Phase 2. 백엔드 혈투: 렌더링 최적화 및 캐시 파이프라인 (Data & Caching Strategy)
 
 ### Task 2-1. 관리자(Admin) 서버 액션에 캐시 무효화(Revalidate) 훅 추가
어드민의 곡 가사 변동 API(Action) 성공 시나리오에 revalidateTag('song-${slug}') 삽입
새로운 곡 추가나 삭제 등의 Action에 revalidatePath('/') 삽입
 
 ### Task 2-2. 앨범 상세(/albums/[slug]) 완전 정적 페이지화 (SSG)
페이지 상단에 generateStaticParams 함수를 내보내어 배포 시점에 ALBUMS 개수만큼 HTML 사전 생성
 
 ### Task 2-3. 응원법 상세 뷰어(/songs/[slug]) 캐시 체인 구성 (태그 기반 ISR)
getSongBySlug(slug) 호출부를 unstable_cache로 래핑하여 훅 생성 (태그: ['song', slug])
실시간 DB 쿼리가 아닌 캐시 히트 동작하는지 개발자 도구 네트워크 확인
 
 ### Task 2-4. 홈 디스코그래피(/page.tsx) 캐시 통제
전체 곡 조회 getAllSongs() 부분에 "use cache" 래핑 처리하여 무분별한 런타임 콜 방지

## Phase 3. 뷰포트 리뉴얼: 핵심 UI/UX 이식 및 연결 (Feature Delivery)
 
 ### Task 3-1. 홈 화면 UI: 디스코그래피 리스트 뷰 개편
거대한 기존 앨범 그리드 삭제
가로형 <AlbumListItem /> (정사각 이미지 1x1 + 우측 텍스트 정렬) 뷰 개발
최신 발매 순 기준 정렬 로직 적용
 
 ### Task 3-2. 응원법 뷰어: Web Share API '공유하기' 버튼 부착
상세 뷰어 내부 Header 컨텍스트에 아이콘 추가
모바일 Web Share API 연동 및 데스크톱 Fallback Toast 모듈 연결
 
 ### Task 3-3. 응원법 뷰어: URL 파라미터(nuqs) 동기화 필터 상태 병합
오피셜/비공식 응원법 뱃지 토글 기능을 UI 로컬 State가 아닌 URL Query parameter로 연동
오피셜 우선 머지 조건부 렌더링 로직 수정 (겹칠 땐 오피셜 우선 등)
 
 ### Task 3-4. 신규 페이지 라우팅: [응원법 리스트] 페이지 개설
하단 네비게이션 '응원법' 탭 클릭 시 연결할 /songs 파이프 파기
캐시된 전체 곡 목록을 불러오고, input 창을 둬서 클라이언트 사이드 기반 즉각 배열 필터링(Instant Search) 구현
 
 ### Task 3-5. 신규 페이지 라우팅: [검색 / 더보기] 페이지 개발
전체 태그 검색 탭 구현
아코디언 컴포넌트를 이용한 공지사항 <NoticeAccordion /> 삽입
점선 모티브 세로형 <VerticalTimeline /> 컴포넌트(업데이트 내역용) 제작
iframe 구글 폼 연동 및 기타 약관 static 링크 추가