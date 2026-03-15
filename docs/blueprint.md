# **[어이어이바위게(OiOiBawige)]** - 프로젝트 블루프린트 (v1.0.0)

본 문서는 프로젝트의 초기 설계와 현재 구현된 상태를 통합하여, 향후 유지보수 및 고도화를 위한 **단일 진실 공급원(Single Source of Truth)** 역할을 수행합니다.

## 1. 브랜드 아이덴티티

- **서비스명:** **어이어이바위게 (OiOiBawige)**
- **도메인:** **`www.oioibawige.com`**
- **핵심 슬로건:** "바위게야 오늘은 응원을 하자"

---

## 2. 최종 데이터 스키마 (`src/libs/db/drizzle/schema.ts`)

단어 단위의 정밀한 응원법(Line Splitter)과 SEO 최적화를 위한 Slug 기반 구조를 채택했습니다.

```typescript
// Drizzle Schema (Song 모델)
export const song = pgTable(
  "Song",
  {
    id: serial().primaryKey().notNull(),
    title: text().notNull(),
    albumName: text().notNull(),
    youtubeId: text().notNull(),
    lyrics: jsonb().notNull(), // LyricLine[] 구조 (Zod 검증)
    hasOfficialCheer: boolean().default(false).notNull(),
    order: integer().default(0).notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
    slug: text().notNull(), // URL용 고유 식별자
  },
  (table) => [
    uniqueIndex("Song_slug_key").using("btree", table.slug.asc().nullsLast().op("text_ops")),
  ],
);

export type Song = typeof song.$inferSelect;
export type InsertSong = typeof song.$inferInsert;
```

---

## 3. 프로젝트 폴더 구조 (Vinext + Cloudflare 최적화)

RSC(Server Component)와 Client Component가 명확히 분리된 구조입니다.

```text
cheer-rock-crab/
├── data/
│   └── lyrics/             # 원본 가사 파일 (.lrc)
├── drizzle/                # SQL 마이그레이션 이력
├── src/
│   ├── app/
│   │   ├── (user)/         # 사용자 페이지 (Server Component 중심)
│   │   │   ├── page.tsx    # 메인 앨범 리스트
│   │   │   ├── albums/     # 앨범 상세 (Parallel Routes/Modals 대응)
│   │   │   └── songs/[slug]/ # [Core] 실시간 응원법 뷰어
│   │   └── admin/          # 관리자 전용 편집기
│   │       ├── actions.ts  # Server Actions (DB 쓰기)
│   │       └── edit/[slug]/ # 가사/싱크 편집기 페이지
│   ├── components/
│   │   ├── admin/          # 에디터 전용 컴포넌트 (Client)
│   │   ├── lyrics/         # 뷰어 전용 컴포넌트 (Client)
│   │   └── ui/             # shadcn/ui 기반 컴포넌트
│   ├── libs/
│   │   └── db/
│   │       ├── drizzle/    # Drizzle ORM (Queries/Commands)
│   │       └── supabase/   # Supabase 인증/클라이언트 설정
│   ├── types/              # 전역 타입 정의 (Zod Schema 포함)
│   └── utils/              # 유틸리티 (lrc-parser, metadata 등)
├── wrangler.jsonc          # Cloudflare Workers/Hyperdrive 설정
├── vite.config.ts          # Vinext (Vite + RSC) 빌드 설정
└── package.json
```

---

## 4. 핵심 기능 명세 및 구현 방식

### [F-1] 어드민 가사 편집기 (Admin Editor)

- **Slug 기반 접근:** `admin/edit/[slug]` 경로를 통해 특정 곡을 즉시 편집.
- **라인 스플리터 (Floating Toolbar):** 가사 드래그 시 플로팅 메뉴를 통해 `Echo`, `Cheer` 세그먼트 즉시 분리 및 속성 부여.
- **실시간 타임스탬프 캡처:** 영상 재생 중 단축키(`Space`)로 `startTime` 자동 입력, `X`키로 `isExtra` 행 즉시 삽입.
- **Server Actions 통합:** 편집 완료 후 `actions.ts`를 통해 `revalidatePath`와 함께 DB 업데이트.

### [F-2] 사용자 응원법 뷰어 (User Sync)

- **YouTube IFrame API 폴링:** `requestAnimationFrame`을 통해 현재 재생 시간을 추적하여 60fps 싱크 구현.
- **광고 감지 로직 (Heuristic):** `videoId` 및 `duration` 편차를 분석하여 광고 재생 시 가사 싱크 자동 일시정지.
- **GSAP 스마트 스냅:** 현재 가사 행을 화면 상단 15% 지점으로 부드럽게 스크롤 정렬.
- **Inline Highlighting:** `isExtra`(추임새) 세그먼트 활성화 시 전용 배경색과 함께 Pop & Glow 애니메이션 적용.

---

## 5. 기술 스택 (Tech Stack)

- **Framework:** **Vinext** (Vite-based Next.js / RSC 지원)
- **Runtime:** **Cloudflare Workers** (Edge Runtime)
- **Database:** Supabase (PostgreSQL)
- **DB Connection:** **Cloudflare Hyperdrive** (Connection Pooling 최적화)
- **ORM:** Drizzle ORM
- **UI/Styling:** Tailwind CSS 4, shadcn/ui, GSAP (Motion)

---

## 6. 데이터 흐름 및 보안

### CQRS 아키텍처

- **Read:** `src/libs/db/drizzle/queries.ts` (서버 컴포넌트에서 직접 호출)
- **Write:** `src/libs/db/drizzle/commands.ts` (Server Actions를 통해 호출)

### 보안 정책

- **관리자 인증:** Supabase Auth를 활용하여 `admin/` 경로 접근 제어.
- **데이터 검증:** `Zod` 스키마를 사용하여 서버/클라이언트 양단에서 가사 데이터 무결성 보장.

---

## 7. 대상 곡 리스트 (Total 24곡)

| 앨범         | 수록곡                                                                     |
| ------------ | -------------------------------------------------------------------------- |
| **Single 1** | 별의 하모니, **Discord**, 수수께끼 다이어리                                |
| **EP 1**     | **고민중독**, SODA, 자유선언, 지구정복, 대관람차, 불꽃놀이, 마니또         |
| **EP 2**     | 가짜아이돌, **내 이름 맑음**, 사랑하자, 달리기, 안녕 나의 슬픔, 메아리     |
| **EP 3**     | **눈물참기**, 행복해져라, 검색어는 QWER, OVERDRIVE, D-Day, Yours Sincerely |
| **Singles**  | 청춘서약, 흰수염고래                                                       |

## 7. 모션/애니메이션 설계 (Inline Cheer & Smart Snap)

기존 리듬게임(레일) 방식 대신 **'응원법 숙달 가이드'** 목적에 부합하는 **[동영상 + 가사 & 응원]** 2단 레이아웃을 채택합니다.

### 7.1 레이아웃 구조 (2단계 스택)

- **좌측/상단 (40%):** 유튜브 플레이어 (16:9 비율 유지, 데스크톱 좌측 고정 / 모바일 상단 고정)
- **우측/하단 (60%):** 응원 통합 가사 뷰 (스크롤 영역)

### 7.2 가사 및 응원법 시각적 표현 (Inline Cheer)

- **메인 가사:** 기본 텍스트 스타일 (`font-bold`).
- **`isExtra` (추임새):** 가사 행 사이에 **독립된 블록**으로 표시. `bg-qwer-e` 배경과 `font-black italic`으로 "지금 바로 외쳐야 함"을 강조.
- **`isEcho` (따라하기):** `text-qwer-r` 컬러와 **밑줄(underline)**을 활용해 "에코 파트"임을 명시.

### 7.3 GSAP 기반 포커스 애니메이션 (The Flow)

- **포커스 효과:** 현재 재생 행은 `scale: 1.05`, `opacity: 100%`, `translate-x: 2`로 강조되며, 이전/이후 행은 `opacity: 50%`로 감쇄됩니다.
- **스마트 스냅:** `gsap.to`의 `scrollTo` 플러그인을 사용하여, 활성 행이 화면 **상단 15% 지점**에 부드럽게 고정되도록 자동 스크롤합니다.
- **Pop & Glow:** `isExtra` 구절의 각 단어(Segment)는 활성 타이밍에 `scale: 1.02`, `brightness(1.5)`, `drop-shadow` 효과와 함께 팝업되는 시각적 피드백을 제공합니다.

---

## 8. 디자인 시스템 & 스타일 가이드

### UI 프레임워크

- **shadcn/ui** (new-york 스타일, neutral 베이스)
- **Tailwind CSS 4** (CSS 변수 기반 엔진)
- **next-themes** — 라이트/다크 모드 전환 (oklch 기반 다크모드 최적화)

### 컬러 토큰

**QWER 로고 멤버 컬러 (테마 불문 고정):**

| 멤버 | 변수         | HEX       | 설명               |
| :--- | :----------- | :-------- | :----------------- |
| Q    | `--qwer-q`   | `#FFFFFF` | White              |
| W    | `--qwer-w`   | `#EF87B5` | Magenta            |
| E    | `--qwer-e`   | `#06BDED` | Blue               |
| R    | `--qwer-r`   | `#C3D773` | Green              |
| BWG  | `--qwer-bwg` | `#427F97` | 바위게 팬클럽 컬러 |

---

## 9. 데이터 흐름 & YouTube 연동

### CQRS 아키텍처

- **Read:** `src/libs/db/drizzle/queries.ts` (서버 컴포넌트 데이터 패칭)
- **Write:** `src/libs/db/drizzle/commands.ts` (DB 명령 캡슐화)
- **Server Actions:** `src/app/admin/actions.ts`를 통한 데이터 갱신 및 캐시 무효화(`revalidatePath`)

### YouTube 연동 및 싱크

- **GSAP Ticker Sync:** `requestAnimationFrame` 대신 **`gsap.ticker`**를 사용하여 60fps 주기로 플레이어 시간을 폴링, 가사/세그먼트 싱크의 정밀도를 극대화합니다.
- **Heuristic 광고 감지 (`useAdWatcher`):**
  - `videoId` 불일치 감지
  - `duration` 편차 분석 (원곡 대비 2초 이상 차이 발생 시 광고로 간주)
  - 광고 중일 경우 가사 싱크 및 스크롤 일시정지

---

## 10. 인프라 및 배포 (Cloudflare Native)

- **Runtime:** Cloudflare Workers (Edge Runtime)
- **Build Tool:** Vinext (Vite-based Next.js Alternative)
- **DB Connection:** **Cloudflare Hyperdrive**를 통한 PostgreSQL(Supabase) 연결 최적화
- **CI/CD:** GitHub Actions를 통한 자동 배포 (staging / production)

---

## 11. 고도화 로드맵 (Backlog)

1. **[미구현] 바위게 리캡 (Recap):** 곡 연습 완료 후 공유용 커스텀 카드 생성 기능.
2. **[진행중] 공식 응원법 연동:** 오피셜 응원법이 있는 곡에 대해 공식 카페 링크 및 뱃지 노출.
3. **[계획] 성능 최적화:** Cloudflare KV를 활용한 가사 데이터 캐싱 레이어 검토.

---

_본 문서는 프로젝트의 실제 구현 상태를 반영하며, 큰 아키텍처 변경 시 반드시 함께 업데이트되어야 합니다._
