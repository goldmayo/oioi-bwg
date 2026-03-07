# **[어이어이바위게(OiOiBawige)]** OR **[치어락크랩(CheerRockCrab)]**

## 1. 브랜드 아이덴티티

- **서비스명:** **어이어이바위게 (OiOiBawige)**
- **도메인:** **`oioi.bwg`**
- **핵심 슬로건:** "바위게야 응원법을 알아보자"

---

## 2. 최종 데이터 스키마 (`src/libs/db/drizzle/schema.ts`)

가장 중요한 부분입니다. 관리자 편집기에서 모든 필드를 제어할 수 있도록 구성했습니다.
단어 단위의 정밀한 응원법(Line Splitter)을 지원하기 위해 `lyrics` JSON 내부는 Segment 기반으로 구성됩니다.

```typescript
// Drizzle Schema (Song 모델)
export const song = pgTable("Song", {
  id: serial().primaryKey().notNull(),
  title: text().notNull(),
  albumName: text().notNull(),
  youtubeId: text().notNull(),
  lyrics: jsonb().notNull(), // LyricLine[] 구조
  hasOfficialCheer: boolean().default(false).notNull(),
  order: integer().default(0).notNull(),
  createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp({ mode: 'string' }).notNull(),
  slug: text().notNull().unique(),
});

export type Song = typeof song.$inferSelect;
export type InsertSong = typeof song.$inferInsert;
```

_JSON 세부 구조 (TypeScript)_:

```typescript
interface LyricSegment {
  text: string;
  isCheer: boolean;
  isEcho: boolean;
}
interface LyricLine {
  startTime: number;
  segments: LyricSegment[]; // 한 줄 내에서 단어별로 플래그를 쪼갬
  isExtra: boolean; // 가사에 없는 독립된 추임새 행
}
```

---

## 3. 최종 폴더 구조 (Vinext + Drizzle 최적화)

관리자 편집 기능을 포함한 최적의 구조입니다.

```text
cheer-rock-crab/
├── data/
│   └── lyrics/             # 번들링에서 제외되는 원본 가사 파일 (.lrc)
├── drizzle/                # Drizzle SQL 마이그레이션 이력
├── src/
│   ├── libs/
│   │   └── db/
│   │       └── drizzle/    # Drizzle ORM 레이어
│   │           ├── index.ts    # DB 클라이언트
│   │           ├── schema.ts   # 테이블 및 타입 정의
│   │           ├── queries.ts  # 읽기 (Read) 전용 함수
│   │           ├── commands.ts # 쓰기 (CUD) 전용 함수
│   │           └── seed.ts     # Drizzle 시딩 스크립트
│   ├── app/
│   │   ├── (user)/         # 사용자 페이지 (메인, 응원법 뷰어)
│   │   │   ├── page.tsx    # 앨범/그리드 리스트
│   │   │   └── songs/[id]/ # 실시간 응원법 싱크 뷰어
│   │   └── admin/          # 관리자 전용 편집기
│   ├── components/         # UI 컴포넌트
│   ├── hooks/              # 비즈니스 로직 훅
│   └── utils/              # 순수 유틸리티 (lrc-parser 등)
├── vite.config.ts          # Vinext 설정
├── drizzle.config.ts       # Drizzle 설정
└── package.json            # 의존성 관리
```

---

## 4. 핵심 기능 명세

### [F-1] 어드민 가사 편집기 (Admin Editor)

- **라인 스플리터 (Floating Toolbar):** 가사 행에서 특정 단어(예: "비가")를 마우스로 드래그하면 즉시 **플로팅 메뉴**가 나타납니다. 메뉴에서 `Echo` 또는 `Cheer` 버튼을 클릭하면 해당 단어만 분리되어 속성이 부여된 Segment 노드로 생성됩니다. (숙련자를 위해 단축키 `E`, `C`도 병행 지원)
- **실시간 타임스탬프 캡처:** 영상 재생 중 단축키(`Space`)를 누르면 해당 시점의 `currentTime`이 현재 편집 중인 행의 `startTime`으로 자동 입력됩니다.
- **isExtra 전용 행 즉시 추가:** 영상 재생 중 단축키(`X`)를 누르면, 현재 시간에 `isExtra: true`인 빈 행을 즉시 삽입하여 가사에 없는 추임새나 네임콜을 타이밍에 맞춰 빠르게 추가할 수 있습니다.
- **상태 관리 (Saving/Done):** 좌측 앨범/곡 사이드바 내비게이션에 곡별 작업 완료 상태 및 저장 중 표시를 노출합니다.
- **광고 시뮬레이터 (Ad-Sim):** 프리뷰 영역에 'Ad-Sim' 버튼을 배치하여, 클릭 시 광고 발생 상황(Player 일시정지 및 메타데이터 이탈)을 시뮬레이션하여 가사 멈춤 로직이 정상 작동하는지 QA 테스트를 지원합니다.
- **Server Actions 저장:** 편집 완료 후 버튼 클릭 시 `commands.ts`의 명령 함수를 통해 데이터가 업데이트되며 즉시 서비스에 반영됩니다.

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

- **Framework:** Vinext (Vite-based Next.js), React 19 (`use` 프로미스 활용)
- **Database:** Supabase (PostgreSQL)
- **ORM:** Drizzle ORM (Type-safe SQL builder)
- **Deployment:** Vercel (Edge Runtime 대응)

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

- **상단 (40%):** 유튜브 플레이어 (16:9 비율 유지, 스크롤 시 Sticky 고정)
- **하단 (60%):** 응원 통합 가사 뷰 (손가락으로 가리지 않는 넉넉한 스크롤 영역)

### 7.2 가사 및 응원법 시각적 표현 (Inline Cheer)

레일을 없애고 가사 리스트 내부에서 응원 타이밍을 직관적으로 표현합니다.

- **메인 가사:** 기본 텍스트 스타일 (Regular weight).
- **`isExtra` (네임콜, 기합):** 가사 행 사이에 **독립된 블록**으로 표시. 디자인 시스템의 `Accent` 컬러 배경과 볼드체로 "지금 바로 외쳐야 함"을 강조.
- **`isEcho` (따라하기):** 메인 가사 끝에 괄호로 붙거나 다음 행에 배치. 디자인 시스템의 `Secondary` 컬러와 이탤릭체로 "에코 파트"임을 명시.

### 7.3 GSAP 기반 포커스 애니메이션 (The Flow)

레일의 역동성을 대신할 '포커스 애니메이션'과 '스마트 스냅'을 강화합니다.

- **포커스 효과:** 현재 불러야 할 가사나 응원법 행이 오면 해당 행만 커지거나(`scale: 1.05`), 하이라이트 색상으로 빛나게(Glow) 처리합니다.
- **모핑 스냅:** 이전 줄은 흐려지며 축소, 다음 줄은 확대되며 중앙(화면 상단 1/3 지점)으로 자동 스크롤(Snap)되도록 GSAP를 활용합니다.
- **마스킹 reveal:** `isEcho`(따라하기) 구절은 마스크 안에서 reveal, `isExtra`는 별도 박스가 확장되며 텍스트가 올라오는 효과를 줍니다.

---

## 8. 디자인 시스템 & 스타일 가이드

### UI 프레임워크

- **shadcn/ui** (new-york 스타일, neutral 베이스)
- **Tailwind CSS 4** + CSS 변수 기반 토큰
- **next-themes** — 라이트/다크 모드 전환 (`defaultTheme="system"`)

### 컬러 토큰

**시스템 컬러:** shadcn 기본 neutral 팔레트 (oklch 기반, light/dark 자동 전환)

**QWER 로고 멤버 컬러 (테마 불문 고정):**

| 멤버 | 변수       | HEX       |
| ---- | ---------- | --------- |
| Q    | `--qwer-q` | `#FFFFFF` |
| W    | `--qwer-w` | `#EF87B5` |
| E    | `--qwer-e` | `#C3D773` |
| R    | `--qwer-r` | `#06BDED` |

**앨범별 컬러 (스포이트로 보정 예정):**

| 앨범                                 | 변수                    | HEX       |
| ------------------------------------ | ----------------------- | --------- |
| Single 1 (Harmony from Discord)      | `--album-single1`       | `#E8A0B5` |
| EP 1 (MANITO) primary                | `--album-ep1-primary`   | `#E85A9A` |
| EP 1 (MANITO) secondary              | `--album-ep1-secondary` | `#7EC8E3` |
| EP 2 (Algorithm's Blossom) primary   | `--album-ep2-primary`   | `#F2D45C` |
| EP 2 (Algorithm's Blossom) secondary | `--album-ep2-secondary` | `#5BC0DE` |
| EP 3 (별의 하모니) primary           | `--album-ep3-primary`   | `#D4735E` |
| EP 3 (별의 하모니) secondary         | `--album-ep3-secondary` | `#2A1F3D` |

### 접근성 — 색맹 지원

색상에만 의존하지 않고, **타이포그래피 스타일로 이중 구분**한다.

| 가사 타입       | 색상             | 보조 시각 단서         |
| --------------- | ---------------- | ---------------------- |
| 일반 가사       | 기본 foreground  | Regular weight         |
| Echo (따라하기) | 브랜드 컬러      | **Bold + 밑줄**        |
| Extra (추임새)  | 다른 브랜드 컬러 | **Italic + 배경 tint** |
| 현재 재생 줄    | 강조 컬러        | **Scale up + Bold**    |

---

## 9. 데이터 흐름 & YouTube 연동

### CQRS 아키텍처

데이터 읽기와 쓰기를 명확히 분리하여 관리합니다.

| 역할 | 방식 | 위치 |
| :--- | :--- | :--- |
| 데이터 조회 (Read) | **Queries** 레이어 캡슐화 | `src/libs/db/drizzle/queries.ts` |
| 데이터 명령 (Write) | **Commands** 레이어 캡슐화 | `src/libs/db/drizzle/commands.ts` |
| 서버 상태 갱신 | Server Actions + `revalidatePath` | `src/app/admin/actions.ts` |

### YouTube 연동 방식

YouTube Data API는 사용하지 않는다. **YouTube IFrame Player API**만 사용한다:

- 무료, 무제한, API 키 불필요 (SDK)
- `player.getCurrentTime()`을 `requestAnimationFrame` 루프로 폴링하여 가사 싱크

### 광고 감지 로직 (Heuristic Ad-Detection)

- **비디오 ID 대조 (`videoId`)**: 원곡 ID와 다르면 광고 상황.
- **재생 시간 대조 (`duration`)**: 비디오 길이 편차가 2초 이상이면 광고 간주.
- **GSAP Ticker 동기화**: 매 프레임(60fps)마다 조건 검사 후 가사 스냅 일시정지.

---

## 고도화

### [곡 디테일 페이지]

1. 메인화면으로 이동할 수 있는 네비게이션 필요 layout.tsx 필요

2. 반응형

- 가사 영역 크기, 텍스트 크기, 가사 간격 조정 필요, 가사가 길면 wrap 처리 필요
- 모바일 화면의 오토 스크롤되는 영역 패딩 필요 동영상 바로 밑에 달라 붙어 보임
- 오피셜 응원법이 있는 곡에는 오피셜 응원 뱃지를 추가.
- 오피셜 응원법이 있는 곡에는 QWER 공식 카페의 오피셜 응원법 포스트 링크 추가

3. 재생바

- 동영상을 클릭해야 동작하는데 재생바가 존재하면 UX 적으로 좋아 보임.
- 재생바 기능 명세 및 설계 필요
- 재생, 중단, 다시듣기등

### [메인페이지]

- 메인 페이지 레이아웃 리뉴얼 현재 카드 형태는 너무 코딩 페이지 같음. 좀더 인터랙티브한 UIUX가 필요
- 앨범 표지 이미지를 사용할 필요가 있음.
- 컨셉 후보

[Bento Grid Expansion] "Harmony Mosaic"
UI: 앨범 카드(앨범표지 이미지)들이 조화로운 그리드 형태로 배치됩니다.

인터랙션: 특정 앨범 카드를 클릭하면 Shared Layout Transition을 통해 해당 카드가 화면의 전체로 확장되며(Zoom-in), 수록곡 카드들이 Stagger 효과와 함께 그리드 형태로 나타납니다.

비주얼: 위에서 정의한 애니메이션 효과를 최대한 적용했으면 합니다.

### [추가 기능]

1. 사용자 회원 가입
2. 플레이 리스트 기능
3. 리캡 기능
