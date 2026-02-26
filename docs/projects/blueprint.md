# **[어이어이바위게(OiOiBawige)]** OR **[치어락크랩(CheerRockCrab)]**

## 1. 브랜드 아이덴티티

- **서비스명:** **어이어이바위게 (OiOiBawige)**
- **도메인:** **`oioi.bwg`**
- **핵심 슬로건:** "바위게야 응원법을 알아보자"

---

## 2. 최종 데이터 스키마 (`prisma/schema.prisma`)

가장 중요한 부분입니다. **이 스키마로 확정**하며, 관리자 편집기에서 모든 필드를 제어할 수 있도록 구성했습니다.

```prisma
// 확정된 단일 모델
model Song {
  id               Int      @id @default(autoincrement())
  title            String
  albumName        String   // 앨범별 그룹화 (Single 1, EP 1 등)
  youtubeId        String   // 기준 유튜브 영상 ID (예: 9_C8D3Cid7Q)
  lyrics           Json     // LyricLine[]:[{ "startTime": 1.2, "text": "가사", "isCheer": true, "isEcho": false, "isExtra": true }]
  hasOfficialCheer Boolean  @default(false) // 공식 가이드 여부
  order            Int      @default(0)     // 앨범 내 트랙 순서
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
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
│   ├── admin/          # LrcImporter, SyncButton, EditorUI
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

- **JSON 직접 수정 방지:** 모든 데이터는 UI를 통해 수정 후 DB로 전송됩니다.
- **LRC 임포터:** `.lrc` 원문을 복사해 넣으면 즉시 파싱되어 에디터에 로드됩니다.
- **실시간 타이밍 트래커:** 유튜브 영상을 보면서 특정 단축키(예: Space)를 누르면 해당 가사 줄에 현재 재생 시간이 즉시 기록됩니다.
- **응원 속성 토글:** 클릭 한 번으로 `isCheer`(응원법), `isEcho`(따라하기) 플래그를 변경합니다.
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

## 7. 모션/애니메이션 설계

ZUBOX 웹 디자인 컨셉을 레퍼런스로, 프로젝트 특성에 맞는 효과를 선별 적용한다.

### 기술 스택

- **GSAP + @gsap/react (`useGSAP`)** — 메인 애니메이션 엔진
- **View Transition API** — 뷰 모드 전환 (네이티브 CSS)
- **CSS animation** — 단순 반복 효과

> Framer Motion은 사용하지 않는다. 가사 싱크처럼 시간 기반 정밀 제어가 필요한 기능이 핵심이므로 GSAP 타임라인이 더 적합하며, 라이브러리 중복을 피한다.

### 적용 효과 목록

| 효과 | 적용 위치 | 구현 방식 | 설명 |
|---|---|---|---|
| 스태거 애니메이션 | 곡 리스트 카드 등장 | GSAP `stagger` | 앨범별 곡 카드가 시간차를 두고 순차적으로 fade-in + slide-up |
| 마스킹 reveal | Echo/Extra 구절 등장 | GSAP `clipPath` | Echo(따라하기) 구절은 마스크 안에서 reveal, Extra(추임새/네임콜)는 별도 박스가 확장되며 텍스트가 올라오는 카드 reveal |
| 모핑 스냅 | 가사 줄 전환 | GSAP | 이전 줄은 흐려지며 축소, 다음 줄은 확대되며 중앙으로 오는 전환 효과 |
| 패럴랙스 히어로 | 메인 상단 | GSAP ScrollTrigger | 스크롤에 따라 배경/중경/전경이 다른 속도로 움직이는 히어로 섹션 |
| 뷰 전환 | 앨범 ↔ 그리드 전환 | View Transition API | 앨범 뷰에서 검색 모드(그리드)로 전환 시 레이아웃 보간 |

### 제외 항목

- **앰비언트 glow (가사 하이라이트 일렁임)** — 응원법 뷰어는 콘서트장에서 바로 따라 불러야 하는 도구이므로 시인성 우선. 가사 하이라이트는 색상 변경 + 크기 강조로 깔끔하게 처리한다.
- **리퀴드/모핑 트랜지션** — View Transition API의 레이아웃 보간으로 대체한다.
- **Lottie** — 디자이너 협업 없는 1인 개발 환경에서는 코드 기반 애니메이션에 집중한다.

---
