# **[어이어이바위게(OiOiBawige)]** OR **[치어락크랩(CheerRockCrab)]**

## 1. 브랜드 아이덴티티

- **서비스명:** **어이어이바위게 (OiOiBawige)**
- **도메인:** **`oioi.bwg`**
- **핵심 슬로건:** "바위게야 응원법을 알아보자"

---

## 2. 최종 데이터 스키마 (`prisma/schema.prisma`)

가장 중요한 부분입니다. **이 스키마로 확정**하며, 관리자 편집기에서 모든 필드를 제어할 수 있도록 구성했습니다.
단어 단위의 정밀한 응원법(Line Splitter)을 지원하기 위해 `lyrics` JSON 내부는 Segment 기반으로 구성됩니다.

```prisma
// 확정된 단일 모델
model Song {
  id               Int      @id @default(autoincrement())
  title            String
  albumName        String   // 앨범별 그룹화 (Single 1, EP 1 등)
  youtubeId        String   // 기준 유튜브 영상 ID (예: 9_C8D3Cid7Q)
  lyrics           Json     // LyricLine[] 구조. 내부에 segments 배열 포함.
  hasOfficialCheer Boolean  @default(false) // 공식 가이드 여부
  order            Int      @default(0)     // 앨범 내 트랙 순서
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

*JSON 세부 구조 (TypeScript)*:
```typescript
interface LyricSegment {
  text: string;
  isCheer: boolean;
  isEcho: boolean;
}
interface LyricLine {
  startTime: number;
  segments: LyricSegment[]; // 한 줄 내에서 단어별로 플래그를 쪼갬
  isExtra: boolean;         // 가사에 없는 독립된 추임새 행
}
```

---

## 3. 최종 폴더 구조 (Next.js 16 대응)

관리자 편집 기능을 포함한 최적의 구조입니다.

```text
cheer-rock-crab/
├── prisma/
│   ├── schema.prisma       # 위 스키마 적용
│   └── seed.ts             # 24곡 초기 데이터 시딩
├── app/
│   ├── (user)/         # 사용자 페이지 (메인, 응원법 뷰어)
│   │   ├── page.tsx    # 앨범/그리드 리스트 (nuqs 적용)
│   │   └── songs/[id]/ # 실시간 응원법 싱크 뷰어
│   └── admin/          # 관리자 전용 편집기 (Admin Editor)
│       ├── page.tsx    # 곡 선택 리스트
│       └── edit/[id]/  # 가사/타이밍 UI 편집 페이지
├── public/             # 정적 에셋
├── components/
│   ├── lyrics/         # SyncPlayer, LyricScroll
│   ├── admin/          # LrcImporter, SyncButton, EditorUI, PreviewRail
│   └── common/         # Header, Footer, CommunityLinks
├── hooks/
│   ├── useYoutubeSync.ts # 사용자용 싱크 로직
│   └── useLyricsEditor.ts# 관리자용 타이밍 편집 로직
├── utils/
│   ├── supabase/       # client.ts, middleware.ts, server.ts
│   └── lrc-parser.ts   # .lrc -> JSON 자동 변환 유틸
└── lib/
│       └── prisma.ts       # Prisma 7 Client (prisma.config.ts 연동)
├── prisma.config.ts        # Prisma 7 전용 설정
├── proxy.ts                # nextjs 16 middleware
├── .env.local              #
└── .env                    #

```

---

## 4. 핵심 기능 명세

### [F-1] 어드민 가사 편집기 (Admin Editor)

- **라인 스플리터 (Floating Toolbar):** 가사 행에서 특정 단어(예: "비가")를 마우스로 드래그하면 즉시 **플로팅 메뉴**가 나타납니다. 메뉴에서 `Echo` 또는 `Cheer` 버튼을 클릭하면 해당 단어만 분리되어 속성이 부여된 Segment 노드로 생성됩니다. (숙련자를 위해 단축키 `E`, `C`도 병행 지원)
- **실시간 타임스탬프 캡처:** 영상 재생 중 단축키(`Space`)를 누르면 해당 시점의 `currentTime`이 현재 편집 중인 행의 `startTime`으로 자동 입력됩니다.
- **isExtra 전용 행 즉시 추가:** 영상 재생 중 단축키(`X`)를 누르면, 현재 시간에 `isExtra: true`인 빈 행을 즉시 삽입하여 가사에 없는 추임새나 네임콜을 타이밍에 맞춰 빠르게 추가할 수 있습니다.
- **상태 관리 (Saving/Done):** 좌측 앨범/곡 사이드바 내비게이션에 곡별 작업 완료 상태 및 저장 중 표시를 노출합니다.
- **광고 시뮬레이터 (Ad-Sim):** 프리뷰 영역에 'Ad-Sim' 버튼을 배치하여, 클릭 시 광고 발생 상황(Player 일시정지 및 메타데이터 이탈)을 시뮬레이션하여 가사 멈춤 로직이 정상 작동하는지 QA 테스트를 지원합니다.
- **Server Actions 저장:** 편집 완료 후 버튼 클릭 시 `prisma.song.update`가 실행되며 즉시 서비스에 반영됩니다.

### [F-2] 사용자 응원법 뷰어 (User Sync)

- **유튜브 IFrame API 연동:** 끊김 없는 실시간 재생 및 제어.
- **앨범 뷰 + 단일 곡 뷰:** 평소에는 앨범별로 묶어 보여주다 검색 시 그리드(Grid) 카드로 전환.
- **응원 하이라이트:** QWER의 컬러 팔레트를 활용해 현재 부르는 응원 구절을 빛나게 연출.
- **스마트 스냅:** 가사가 바뀔 때마다 화면 중앙으로 자동 부드럽게 스크롤.

- **행 단위 싱크:** `.lrc` 파일 기반의 데이터 구조로 개발 공수는 줄이고 가독성은 극대화.
- **응원법 타입 구분:**
- **Type A (Echo):** 가사를 그대로 따라 부르는 경우 (불리언 `isEcho` 처리).
- **Type B (Extra):** 네임콜, 추임새 등 가사에 없는 내용 추가.

### ③ 바위게 리캡 (Recap)

- **연습 인증:** 특정 곡의 연습 완료 후, 공유할 수 있는 커스텀 카드 생성 (like 유투브 리캡).

---

## 5. 기술 스택 요약

- **Framework:** Next.js 16 (App Router), React 19 (`use` 프로미스 활용)
- **Database:** Supabase (Auth, Storage 포함)
- **ORM:** Prisma 7 (`prisma.config.ts`)
- **Deployment:** Vercel

---

## 6. 대상 곡 리스트 (Total 24곡)

| 앨범         | 수록곡                                                                     |
| ------------ | -------------------------------------------------------------------------- |
| **Single 1** | 별의 하모니, **Discord**, 수수께끼 다이어리                                |
| **EP 1**     | **고민중독**, SODA, 자유선언, 지구정복, 대관람차, 불꽃놀이, 마니또         |
| **EP 2**     | 가짜아이돌, **내 이름 맑음**, 사랑하자, 달리기, 안녕 나의 슬픔, 메아리     |
| **EP 3**     | **눈물참기**, 행복해져라, 검색어는 QWER, OVERDRIVE, D-Day, Yours Sincerely |
| **Singles**  | 청춘서약, 흰수염고래                                                       |

---

## 7. 모션/애니메이션 설계 (Inline Cheer & Smart Snap)

기존 리듬게임(레일) 방식 대신 **'응원법 숙달 가이드'** 목적에 부합하는 **[동영상 + 가사 & 응원]** 2단 레이아웃을 채택합니다.

### 7.1 레이아웃 구조 (2단계 수직 스택)
*   **상단 (40%):** 유튜브 플레이어 (16:9 비율 유지, 스크롤 시 Sticky 고정)
*   **하단 (60%):** 응원 통합 가사 뷰 (손가락으로 가리지 않는 넉넉한 스크롤 영역)

### 7.2 가사 및 응원법 시각적 표현 (Inline Cheer)
레일을 없애고 가사 리스트 내부에서 응원 타이밍을 직관적으로 표현합니다.
*   **메인 가사:** 기본 텍스트 스타일 (Regular weight).
*   **`isExtra` (네임콜, 기합):** 가사 행 사이에 **독립된 블록**으로 표시. 디자인 시스템의 `Accent` 컬러 배경과 볼드체로 "지금 바로 외쳐야 함"을 강조.
*   **`isEcho` (따라하기):** 메인 가사 끝에 괄호로 붙거나 다음 행에 배치. 디자인 시스템의 `Secondary` 컬러와 이탤릭체로 "에코 파트"임을 명시.

### 7.3 GSAP 기반 포커스 애니메이션 (The Flow)
레일의 역동성을 대신할 '포커스 애니메이션'과 '스마트 스냅'을 강화합니다.
*   **포커스 효과:** 현재 불러야 할 가사나 응원법 행이 오면 해당 행만 커지거나(`scale: 1.05`), 하이라이트 색상으로 빛나게(Glow) 처리합니다.
*   **모핑 스냅:** 이전 줄은 흐려지며 축소, 다음 줄은 확대되며 중앙(화면 상단 1/3 지점)으로 자동 스크롤(Snap)되도록 GSAP를 활용합니다.
*   **마스킹 reveal:** `isEcho`(따라하기) 구절은 마스크 안에서 reveal, `isExtra`는 별도 박스가 확장되며 텍스트가 올라오는 효과를 줍니다.

---

## 8. 디자인 시스템 & 스타일 가이드

### UI 프레임워크

- **shadcn/ui** (new-york 스타일, neutral 베이스)
- **Tailwind CSS 4** + CSS 변수 기반 토큰
- **next-themes** — 라이트/다크 모드 전환 (`defaultTheme="system"`)

### 컬러 토큰

**시스템 컬러:** shadcn 기본 neutral 팔레트 (oklch 기반, light/dark 자동 전환)

**QWER 로고 멤버 컬러 (테마 불문 고정):**

| 멤버 | 변수 | HEX |
|---|---|---|
| Q | `--qwer-q` | `#FFFFFF` |
| W | `--qwer-w` | `#EF87B5` |
| E | `--qwer-e` | `#C3D773` |
| R | `--qwer-r` | `#06BDED` |

**앨범별 컬러 (스포이트로 보정 예정):**

| 앨범 | 변수 | HEX |
|---|---|---|
| Single 1 (Harmony from Discord) | `--album-single1` | `#E8A0B5` |
| EP 1 (MANITO) primary | `--album-ep1-primary` | `#E85A9A` |
| EP 1 (MANITO) secondary | `--album-ep1-secondary` | `#7EC8E3` |
| EP 2 (Algorithm's Blossom) primary | `--album-ep2-primary` | `#F2D45C` |
| EP 2 (Algorithm's Blossom) secondary | `--album-ep2-secondary` | `#5BC0DE` |
| EP 3 (별의 하모니) primary | `--album-ep3-primary` | `#D4735E` |
| EP 3 (별의 하모니) secondary | `--album-ep3-secondary` | `#2A1F3D` |

### 접근성 — 색맹 지원

색상에만 의존하지 않고, **타이포그래피 스타일로 이중 구분**한다.

| 가사 타입 | 색상 | 보조 시각 단서 |
|---|---|---|
| 일반 가사 | 기본 foreground | Regular weight |
| Echo (따라하기) | 브랜드 컬러 | **Bold + 밑줄** |
| Extra (추임새) | 다른 브랜드 컬러 | **Italic + 배경 tint** |
| 현재 재생 줄 | 강조 컬러 | **Scale up + Bold** |

---

## 9. 데이터 흐름 & YouTube 연동

### 데이터 페칭 전략

TanStack Query는 사용하지 않는다. 실시간 데이터나 복잡한 캐시 무효화가 필요 없는 구조이므로 Next.js 네이티브 방식으로 충분하다.

| 역할 | 방식 |
|---|---|
| 서버 데이터 로딩 | **Server Components** (RSC) — Prisma 직접 호출 |
| 데이터 뮤테이션 | **Server Actions** + `revalidateTag` |
| URL 상태 | **nuqs** (이미 설치됨) |
| 클라이언트 상태 | React `useState` / `useRef` (가사 싱크, 편집 중 데이터) |

### Prisma 쿼리 캐싱

Supabase Free Tier 제한 (동시 연결 60개, 월 대역폭 5GB)을 고려하여 `unstable_cache`로 DB 호출을 캐싱한다. 곡 데이터는 어드민이 수정할 때만 변경되므로 캐시 TTL을 길게 잡고, 수정 시 `revalidateTag`로 즉시 무효화한다.

**쿼리 레이어 구조:**

```
libs/
├── prisma.ts          # Prisma Client 인스턴스
├── queries/           # 읽기 전용 캐시 쿼리 (Server Components에서 호출)
│   └── songs.ts       # getSongs, getSongById, getSongsByAlbum
└── actions/           # Server Actions (뮤테이션 + 캐시 무효화)
    └── songs.ts       # updateSongLyrics 등
```

**캐싱 규칙:**

| 쿼리 | 캐시 태그 | TTL | 무효화 시점 |
|---|---|---|---|
| 곡 리스트 | `songs-list` | 1시간 | 어드민 저장 시 |
| 곡 상세 | `song-detail` | 1시간 | 어드민 저장 시 |
| 앨범별 곡 | `songs-list` | 1시간 | 어드민 저장 시 |

> 사용자 100명이 동시에 곡 리스트를 조회해도 DB 호출은 1회. 나머지는 캐시 히트.

### YouTube 연동 방식

YouTube Data API는 사용하지 않는다 (일일 쿼터 10,000 units 제한, API 키 필요).

**YouTube IFrame Player API**만 사용한다:
- 무료, 무제한, API 키 불필요 (브라우저 클라이언트 SDK)
- DB의 `youtubeId`로 IFrame 임베딩
- `player.getCurrentTime()`을 `requestAnimationFrame` 루프로 폴링하여 가사 싱크

**사용하는 Player API:**

| 메서드 | 용도 |
|---|---|
| `getCurrentTime()` | 현재 재생 시간 → 가사 줄 매칭 |
| `getPlayerState()` | 재생/일시정지 상태 감지 |
| `seekTo(seconds)` | 특정 가사 줄 클릭 시 해당 시간으로 이동 |
| `playVideo()` / `pauseVideo()` | 재생 제어 |

### 광고 감지 로직 (Heuristic Ad-Detection)

네트워크 패킷을 뜯지 않고 유튜브 IFrame API의 **메타데이터 변화**를 감시하는 가장 확실한 방법입니다.

* **비디오 ID 대조 (`videoId`)**: 현재 재생 중인 영상 ID가 우리가 DB에서 불러온 곡의 ID와 다르면 100% 광고 상황입니다.
* **재생 시간 대조 (`duration`)**: 광고 영상은 보통 5초, 15초, 30초 등 원곡과 길이가 확연히 다릅니다. `player.getDuration()` 값이 DB에 저장된 곡 길이와 2초 이상 차이 나면 광고로 간주합니다.
* **플레이어 상태 감지 (`playerState`)**: 상태 값이 `3`(Buffering)으로 변하며 ID나 Duration이 위 조건에 해당할 때 싱크를 즉시 잠금(Lock)합니다.
* **GSAP Ticker 동기화**: `gsap.ticker`를 통해 매 프레임(60fps)마다 위 조건들을 검사하여, 광고 감지 시 가사 스크롤 애니메이션을 `pause()` 시킵니다.

---
