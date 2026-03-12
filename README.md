# 어이어이바위게 (OiOiBawige)

> **"바위게야 응원법을 알아보자"**

- **LIVE**: [oioibawige.com](https://oioibawige.com)

![Main Preview](docs/screenshots/oioibwg_user_main.png)

어이어이바위게(OiOiBawige) 는 QWER 팬덤 '바위게'를 위한 비공식 응원법 가이드 서비스입니다. 앵콜 콘서트와 각종 행사에서 함께 즐길 수 있도록 유튜브 영상과 실시간으로 동기화되는 가사 및 응원법 자막을 통해 누구나 쉽게 응원 리듬을 익힐 수 있습니다. 정답을 정의하기보다 모두가 각자의 목소리로 QWER을 응원하는 즐거운 순간을 위해 개발했습니다.

## 핵심 기능 (Key Features)

### 1. 사용자 응원법 뷰어 (User Sync Viewer)

![Viewer Screenshot](docs/screenshots/oioibwg_song.png)

- **실시간 유튜브 연동**: YouTube IFrame API를 활용하여 영상 재생 시간과 가사를 1/60초 단위로 정밀하게 동기화합니다.
- **스마트 스냅 (Smart Snap)**: 현재 재생 중인 가사 행이 화면 중앙에 오도록 GSAP 기반의 부드러운 자동 스크롤을 지원합니다.
- **응원 하이라이트**: 에코(Echo) 파트와 추임새(Extra) 파트를 시각적으로 구분하여 직관적인 응원 가이드를 제공합니다.
- **광고 감지 로직**: 영상 재생 중 광고 발생 시 가사 싱크를 일시 정지하는 휴리스틱 감지 기능을 포함합니다.

### 2. 어드민 가사 편집기 (Admin Editor)

![Admin Editor Screenshot](docs/screenshots/oioibwg_admin_edit.png)

- **라인 스플리터**: 드래그 앤 드롭과 플로팅 메뉴를 통해 단어 단위로 `Echo(함께 부르기)` 속성을 부여할 수 있습니다.
- **실시간 타임스탬프 캡처**: 단축키(Space)를 사용하여 영상 재생 중 즉시 `startTime`을 기록합니다.
- **엑스트라 행 관리**: 가사에 없는 네임콜이나 기합을 위한 전용 행을 빠르게 삽입하고 그룹화 할 수 있습니다.

---

## 기술 스택 (Tech Stack)

### Framework & Library

- **Framework**: [Vinext](https://github.com/cloudflare/vinext) (Vite-based Next.js), React 19
- **Styling**: Tailwind CSS 4, Shadcn UI
- **Animation**: GSAP
- **State & Form**: React Hook Form, Zod, nuqs

### Database & Backend

- **Database**: Supabase (PostgreSQL)
- **ORM**: Drizzle ORM
- **Deployment**: GitHub Actions & Wrangler

### Infrastructure

- **Runtime**: Cloudflare Workers
- **Connection**: Cloudflare Hyperdrive (Database connection pooling)
- **Monitoring**: Sentry (Error & Performance tracking)
- **Analytics**: Google Analytics & Google Tag Manager

---

## 프로젝트 구조 (Project Structure)

```text
cheer-rock-crab/
├── data/lyrics/        # 원본 가사 파일 (.lrc)
├── drizzle/            # SQL 마이그레이션 이력
├── src/
│   ├── app/
│   │   ├── (user)/     # 사용자 페이지 (메인, 뷰어)
│   │   └── admin/      # 관리자 편집기
│   ├── components/     # UI 및 비즈니스 컴포넌트
│   ├── libs/db/        # Drizzle ORM 레이어 (Queries, Commands)
│   ├── hooks/          # 커스텀 훅 (LyricsEditor, AdWatcher 등)
│   └── utils/          # 가사 파서 및 유틸리티
├── wrangler.jsonc      # Cloudflare 설정
└── package.json        # 의존성 및 스크립트

```

---

## 서비스 운영 철학 (Philosophy)

본 서비스는 **"응원법의 정답을 정의하는 곳"**이 아니라, **"함께 즐기기 위한 응원 법을 공유하는 서비스"**입니다.

- **공식 응원법**: `OfficialBadge`를 통해 출처를 명확히 밝힙니다.
- **제안 응원법**: 개인적인 경험을 바탕으로 한 제안이며, 사용자의 자유로운 응원을 존중합니다.
- **비영리 프로젝트**: 본 서비스는 팬이 만든 비영리 프로젝트입니다.

---

## 시작하기 (Getting Started)

### 설치

```bash
pnpm install

```

### 개발 서버 실행

```bash
pnpm dev

```

### 데이터베이스 마이그레이션

```bash
pnpm db:push

```

### 배포

```bash
pnpm deploy

```

---

_Last Updated: 2026-03-13_
_Copyright © 2026 CheerRockCrab Team._
