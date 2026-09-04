---
title: "As-Is 화면 설계서 / UI Description"
document_id: "RE-SCREEN-SPEC-001"
version: "0.1.2"
status: "draft"
authority: "plan"
updated_at: "2026-09-05"
tags:
  - "reverse-engineering"
  - "screen-spec"
  - "as-is"
---

## Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.2 | 2026-09-05 | - | 곡 뷰어 광고 감지에 따른 동기화·자동 스크롤 일시 중지 동작 반영 |
| 0.1.1 | 2026-09-05 | - | 1차 프로세스와 정책 slug 동작 정합성 보정 및 확인 필요 항목 재검증 |
| 0.1.0 | 2026-09-05 | - | 현재 구현 기준 2차 화면 설계서 최초 작성 |

# As-Is 화면 설계서 / UI Description

## 1. 분석 기준

본 문서는 동결된 1차 Screen ID를 기준으로 실제 Route, Page, Component, Feature UI, Form Schema, Client State, Server Service 및 테스트 코드를 대조하여 작성했다.

- 분석 범위: `SCR-PUB-001` ~ `SCR-PUB-010`, `SCR-AUTH-001`, `SCR-ADM-001` ~ `SCR-ADM-004`
- 접근 범위 용어: `Public`, `Guest Only`, `Admin`
- 코드 근거가 없는 UX는 추가하지 않는다.

## 2. 공통 규칙

| 항목 | 확인된 동작 |
|---|---|
| 공개 Layout | 홈·응원법·더보기 Global Navigation과 Footer를 제공한다. |
| 관리자 Layout | 관리자 사이드바와 콘텐츠 영역을 제공한다. |
| 공개 상세 실패 | 앨범/곡 slug 조회 결과가 없으면 공통 404 화면으로 이동한다. |
| 관리자 접근 실패 | session이 없으면 `/admin-login`, `manage all` 권한이 없으면 forbidden 처리한다. |
| 별도 UI 확인이 없는 상태 | 이상적인 문구나 컴포넌트를 추가하지 않고 확인되지 않음으로 기록한다. |

## 3. Public 화면

## SCR-PUB-001 홈

### 기본 정보

| 항목 | 내용 |
|---|---|
| Screen ID | SCR-PUB-001 |
| 화면명 | 홈 |
| URL | `/` |
| 접근 범위 | Public |
| 구현 위치 | `src/app/(user)/page.tsx`, `src/app/(user)/_ui/responsive-album-list.tsx` |
| 주요 목적 | 공개 앨범과 수록곡을 탐색하고 상세 화면으로 이동 |

### 주요 UI 구성

| UI 영역 | 표시 데이터 | 표시 조건 | 주요 인터랙션 |
|---|---|---|---|
| 서비스 헤더 | 서비스명, 슬로건, 안내 문구 | 항상 | 없음 |
| 앨범 목록 | 공개 앨범, 앨범 이미지, 앨범명, 수록곡 수, 대표 색상 | 조회 결과가 있는 항목 | 앨범 선택 |
| 모바일 앨범 항목 | 앨범 정보와 수록곡 | 모바일 viewport | 펼치기/접기, 곡 선택, 앨범 상세 이동 |
| 데스크톱 앨범 카드 | 앨범 이미지와 기본 정보 | `md` 이상 viewport | 앨범 상세 이동 |

### 화면 상태

| 상태 | 조건 | UI 동작 |
|---|---|---|
| Loading | 앨범 목록 Server Component 요청 중 | `AlbumListSkeleton` 표시 |
| Default | 공개 앨범 목록 조회 성공 | 앨범 목록 표시 |
| Empty | 곡이 없는 앨범은 목록 매핑 후 제외됨 | 전체 목록이 비는 경우의 별도 Empty UI는 확인되지 않음 |
| Error | 목록 조회 실패 | 화면 전용 Error UI는 확인되지 않음 |

### Validation / Disabled / Text Rule

- Validation: 해당 없음
- Disabled: 해당 없음
- 텍스트 제한: 별도 최대 글자 수 규칙은 확인되지 않음. 일부 앨범명·곡명은 CSS `truncate`로 표시된다.

### 화면 이동

- 앨범 카드 또는 모바일 앨범 상세 링크 → `/albums/{slug}`
- 모바일 펼침 목록의 곡 선택 → `/songs/{slug}`

## SCR-PUB-002 응원법 리스트

### 기본 정보

| 항목 | 내용 |
|---|---|
| Screen ID | SCR-PUB-002 |
| 화면명 | 응원법 리스트 |
| URL | `/chants` |
| 접근 범위 | Public |
| 구현 위치 | `src/app/(user)/chants/page.tsx`, `src/app/(user)/chants/_ui/filtered-chant-list.tsx` |
| 주요 목적 | 공개 곡 목록을 검색하고 곡 응원법 뷰어로 이동 |

### 주요 UI 구성

| UI 영역 | 표시 데이터 | 표시 조건 | 주요 인터랙션 |
|---|---|---|---|
| 검색 입력 | 곡명 또는 앨범명 검색어 | 항상 | 입력 시 목록 필터 |
| 곡 결과 카드 | 앨범 커버, 곡명, 앨범명 | 필터 결과가 있는 경우 | 연습하기 클릭 → 곡 뷰어 |
| Empty 결과 영역 | `검색 결과가 없습니다.` | 필터 결과 0건 | 별도 재설정 버튼 없음 |

### 화면 상태

| 상태 | 조건 | UI 동작 |
|---|---|---|
| Loading | 초기 공개 목록 요청 중 | `AlbumListSkeleton` 표시 |
| Default | 곡 목록 조회 성공 | 전체 곡 목록 표시 |
| Empty | 검색어가 곡명·앨범명과 일치하지 않음 | 검색 결과 없음 문구 표시 |
| Error | 목록 조회 실패 | 화면 전용 Error UI는 확인되지 않음 |

### Validation / Disabled / Text Rule

- 검색어: 문자열 입력; 별도 길이 제한 확인되지 않음.
- 검색 입력은 `query` 문자열 schema를 사용한다.
- 검색어 공백만 입력하면 전체 목록을 표시한다.
- 검색 결과 카드의 제목과 앨범명은 `line-clamp-1`로 표시한다.
- Disabled: 해당 없음.

### 화면 이동

- 결과 카드 → `/songs/{slug}`

## SCR-PUB-003 앨범 상세

### 기본 정보

| 항목 | 내용 |
|---|---|
| Screen ID | SCR-PUB-003 |
| 화면명 | 앨범 상세 |
| URL | `/albums/{slug}` |
| 접근 범위 | Public |
| 구현 위치 | `src/app/(user)/albums/[slug]/page.tsx`, `_ui/album-detail-modal.tsx` |
| 주요 목적 | 앨범 정보와 수록곡을 표시하고 곡 뷰어로 이동 |

### 주요 UI 구성

| UI 영역 | 표시 데이터 | 표시 조건 | 주요 인터랙션 |
|---|---|---|---|
| Backdrop 및 상세 컨테이너 | 앨범 이미지, 앨범명, 대표 색상 | 유효한 album slug | 닫기 |
| 앨범 정보 | 이미지, 이름, 앨범명 파싱 결과 | 항상 | 없음 |
| 수록곡 목록 | 트랙 번호, 곡명, 타이틀곡 badge | 앨범 곡 데이터가 있는 경우 | 곡 선택 |
| 닫기 버튼/Backdrop | 닫기 동작 | 상세 화면 | 홈으로 이동 |

### 화면 상태

| 상태 | 조건 | UI 동작 |
|---|---|---|
| Loading | 상세 조회 중 | route `loading.tsx`의 상세 skeleton 사용 |
| Default | 앨범 조회 성공 | 상세 UI 표시 |
| Not Found | slug가 없거나 앨범 조회 결과 없음 | 공통 404 화면 |
| Error | 조회 실패 | 별도 화면 전용 Error UI는 확인되지 않음 |

### Validation / Disabled / Text Rule

- slug는 dynamic route parameter로 전달된다. 해당 slug의 앨범 조회 결과가 없으면 `notFound()` 처리된다.
- Disabled: 해당 없음.
- 앨범명과 곡명에 별도 최대 글자 수 규칙은 확인되지 않음.

### 화면 이동

- 곡 선택 → `/songs/{slug}`
- 닫기 완료 → `/`
- 앨범 공식 링크가 데이터에 존재하는 경우 새 창 링크 표시

## SCR-PUB-004 곡 응원법 뷰어

### 기본 정보

| 항목 | 내용 |
|---|---|
| Screen ID | SCR-PUB-004 |
| 화면명 | 곡 응원법 뷰어 |
| URL | `/songs/{slug}` |
| 접근 범위 | Public |
| 구현 위치 | `src/app/(user)/songs/[slug]/page.tsx`, `src/features/chant-sync/ui/LyricsViewerClient.tsx`, `src/shared/ui/YouTubePlayer.tsx` |
| 주요 목적 | YouTube 재생 시간에 맞춰 가사와 응원 구간을 표시 |

### 주요 UI 구성

| UI 영역 | 표시 데이터 | 표시 조건 | 주요 인터랙션 |
|---|---|---|---|
| YouTube Player | song의 `youtubeId` | 곡 상세 조회 성공 | 재생/일시정지 등 YouTube 기본 조작 |
| 곡 정보 | 곡명, 앨범명 | 앨범 정보가 있는 경우 | 앨범 상세 이동, 정보 accordion 토글 |
| 공유 버튼 | 현재 페이지 URL | 앨범 정보가 있는 경우 | 클립보드 복사 및 toast |
| 가사 목록 | 가사 행, 세그먼트, `startTime`, `isExtra`, `isEcho`, `isCheer` | lyrics 데이터 | 가사 행 클릭 시 해당 시간으로 seek |
| 활성 행 | 현재 재생 시간에 해당하는 행 | YouTube 재생 중 | 상단 15% 위치로 자동 스크롤 |
| Extra 세그먼트 강조 | Extra 행의 상대 시작 시간 | Extra 행 활성화 | 대상 세그먼트 pop/glow |

### 화면 상태

| 상태 | 조건 | UI 동작 |
|---|---|---|
| Loading | 곡 상세 조회 중 또는 Player API 준비 전 | route loading 또는 `Loading Player...` 표시 |
| Default | 곡과 Player 준비 완료 | YouTube와 가사 표시 |
| Advertising | 광고 상태 감지 | 가사 시간 동기화와 자동 스크롤 일시 중지; 광고 종료 후 재개 |
| Not Found | slug가 없거나 곡 조회 결과 없음 | 공통 404 화면 |
| Empty | lyrics가 빈 배열인 경우 | 별도 Empty UI는 확인되지 않음 |
| Error | YouTube/클립보드/조회 실패 | YouTube 자체 오류 또는 toast 외의 화면 전용 오류 UI는 확인되지 않음 |

### Interaction / Text Rule

- 일반 가사 행은 클릭 시 `startTime`으로 이동한다.
- `isEcho` 세그먼트는 에코 스타일, `isCheer` 세그먼트는 응원 스타일로 표시한다.
- `isExtra` 행은 세그먼트 단위로 현재 활성 구간을 강조한다.
- 가사 영역은 세로 스크롤 가능하며 자동 스크롤이 활성 행을 보정한다.
- 곡명은 `truncate` 표시되며 별도 글자 수 제한은 확인되지 않는다.
- Disabled: 해당 없음.

### 화면 이동

- 앨범명 클릭 → `/albums/{slug}`
- 공식 앨범 링크가 존재하면 외부 새 창 이동
- 공유 성공 → `링크가 복사되었습니다.` toast
- 공유 실패 → `링크 복사에 실패했습니다.` error toast

## SCR-PUB-005 더보기

### 기본 정보

| 항목 | 내용 |
|---|---|
| Screen ID | SCR-PUB-005 |
| 화면명 | 더보기 |
| URL | `/more` |
| 접근 범위 | Public |
| 구현 위치 | `src/app/(user)/more/page.tsx` |
| 주요 목적 | 공지, 오류 제보, 업데이트, 정책 화면으로 이동 |

### 주요 UI 구성

| UI 영역 | 표시 데이터 | 표시 조건 | 주요 인터랙션 |
|---|---|---|---|
| 메뉴 섹션 | Notice, Report, Service Info, Policy | 항상 | 하위 메뉴 선택 |
| 메뉴 항목 | 항목명, 설명, 아이콘 | 각 섹션에 정의된 항목 | 해당 URL 이동 |

### 화면 상태 / Validation / Text Rule

- Default: 정적 메뉴 표시.
- Loading, Empty, Error, Disabled, Validation: 해당 없음.
- 메뉴명·설명에 별도 글자 수 제한은 확인되지 않음.

### 화면 이동

- 공지사항 → `/more/notice`
- 오류 제보 → `/more/report`
- 업데이트 내역 → `/more/updates`
- 안내 및 약관 → `/more/policy`

## SCR-PUB-006 공지사항

### 기본 정보

| 항목 | 내용 |
|---|---|
| Screen ID | SCR-PUB-006 |
| 화면명 | 공지사항 |
| URL | `/more/notice` |
| 접근 범위 | Public |
| 구현 위치 | `src/app/(user)/more/notice/page.tsx`, `_ui/notice-accordion.tsx` |
| 주요 목적 | 공지 목록과 공지 내용을 확인 |

### 주요 UI 구성 및 상태

| UI 영역 | 표시 데이터 | 표시 조건 | 주요 인터랙션 |
|---|---|---|---|
| 공지 항목 | category, date, title, content | 정적 공지 데이터 | 클릭으로 내용 펼치기/접기 |
| 빈 목록 | 해당 없음 | 현재 코드에서 빈 목록 UI 없음 | 해당 없음 |

- Loading, Empty, Error, Disabled, Validation: 별도 구현 확인되지 않음.
- Text Rule: 제목·본문의 별도 최대 길이 제한은 확인되지 않음.

### 화면 이동

- 뒤로가기 버튼 → 이전 정보 화면 또는 지정된 상위 경로

## SCR-PUB-007 안내 및 약관

### 기본 정보

| 항목 | 내용 |
|---|---|
| Screen ID | SCR-PUB-007 |
| 화면명 | 안내 및 약관 |
| URL | `/more/policy` |
| 접근 범위 | Public |
| 구현 위치 | `src/app/(user)/more/policy/page.tsx` |
| 주요 목적 | 정책 문서 목록 제공 |

### 주요 UI 구성 및 상태

| UI 영역 | 표시 데이터 | 표시 조건 | 주요 인터랙션 |
|---|---|---|---|
| 정책 목록 | 개인정보 처리방침, 이용 약관, 저작권 정책, 이메일 무단 수집 거부, GA 수집 안내 | 정적 목록 | 정책 상세 링크 이동 |

- Default: 정책 목록 표시.
- Loading, Empty, Error, Disabled, Validation: 해당 없음.
- Text Rule: 정책명·설명에 별도 최대 길이 제한은 확인되지 않음.

### 화면 이동

- 정책 항목 → `/more/policy/{slug}`

## SCR-PUB-008 정책 상세

### 기본 정보

| 항목 | 내용 |
|---|---|
| Screen ID | SCR-PUB-008 |
| 화면명 | 정책 상세 |
| URL | `/more/policy/{slug}` |
| 접근 범위 | Public |
| 구현 위치 | `src/app/(user)/more/policy/[slug]/page.tsx` |
| 주요 목적 | 정책 본문과 적용일 표시 |

### 주요 UI 구성 및 상태

| UI 영역 | 표시 데이터 | 표시 조건 | 주요 인터랙션 |
|---|---|---|---|
| 정책 헤더 | 제목, Effective Date | 정책 데이터 존재 | 없음 |
| 정책 본문 | 조항 문자열 목록 | 항상 | 없음 |
| 상위 이동 | Back to Policy | 항상 | `/more/policy` 이동 |

- Default: 정적 정책 본문 표시.
- 잘못된 slug도 기본적으로 `privacy` 상세를 선택하므로 별도 Not Found 처리는 확인되지 않음.
- Loading, Empty, Error, Disabled, Validation: 해당 없음.
- Text Rule: 본문에 별도 글자 수 제한은 확인되지 않음.

## SCR-PUB-009 오류 제보

### 기본 정보

| 항목 | 내용 |
|---|---|
| Screen ID | SCR-PUB-009 |
| 화면명 | 오류 제보 |
| URL | `/more/report` |
| 접근 범위 | Public |
| 구현 위치 | `src/app/(user)/more/report/page.tsx` |
| 주요 목적 | 외부 Google Form을 통한 오류 제보 진입 |

### 주요 UI 구성 및 상태

| UI 영역 | 표시 데이터 | 표시 조건 | 주요 인터랙션 |
|---|---|---|---|
| Form iframe | 외부 Google Form | 화면 진입 시 | 외부 폼 작성 |
| 로딩 오버레이 | `Loading Form...` | iframe `onLoad` 전 | iframe 로드 완료 시 제거 |
| 새 창 링크 | `새 창에서 열기` | 항상 | 외부 Form 새 창 열기 |

- Loading: iframe 로드 전 spinner와 문구 표시.
- Empty, Error, Disabled, Validation: 외부 Form 내부 동작은 저장소에서 확인되지 않음.
- Text Rule: 별도 제한 확인되지 않음.

### 화면 이동

- 새 창에서 열기 → 외부 Google Form

## SCR-PUB-010 업데이트 내역

### 기본 정보

| 항목 | 내용 |
|---|---|
| Screen ID | SCR-PUB-010 |
| 화면명 | 업데이트 내역 |
| URL | `/more/updates` |
| 접근 범위 | Public |
| 구현 위치 | `src/app/(user)/more/updates/page.tsx` |
| 주요 목적 | 서비스 버전별 업데이트 내역 표시 |

### 주요 UI 구성 및 상태

| UI 영역 | 표시 데이터 | 표시 조건 | 주요 인터랙션 |
|---|---|---|---|
| 업데이트 타임라인 | 버전, 날짜, 제목, 항목 목록, 현재 버전 여부 | 정적 업데이트 데이터 | 없음 |

- Default: 업데이트 타임라인 표시.
- Loading, Empty, Error, Disabled, Validation: 해당 없음.
- Text Rule: 항목별 별도 길이 제한은 확인되지 않음.

## 4. 인증 화면

## SCR-AUTH-001 관리자 로그인

### 기본 정보

| 항목 | 내용 |
|---|---|
| Screen ID | SCR-AUTH-001 |
| 화면명 | 관리자 로그인 |
| URL | `/admin-login` |
| 접근 범위 | Guest Only |
| 구현 위치 | `src/app/admin-login/page.tsx`, `src/features/auth/ui/LoginForm.tsx` |
| 주요 목적 | 관리자 계정으로 로그인 |

### 주요 UI 구성

| UI 영역 | 표시 데이터 | 표시 조건 | 주요 인터랙션 |
|---|---|---|---|
| 이메일 입력 | email | 항상 | 이메일 입력 |
| 비밀번호 입력 | password | 항상 | 비밀번호 입력 |
| 오류 영역 | 인증 실패 또는 처리 오류 메시지 | 오류 발생 시 | 오류 확인 |
| 로그인 버튼 | 기본 `로그인`, pending `로그인 중...` | 항상 | Credentials 로그인 요청 |
| 홈 이동 | `홈으로 돌아가기` | 항상 | `/` 이동 |

### 화면 상태

| 상태 | 조건 | UI 동작 |
|---|---|---|
| Default | 로그인 화면 진입 | 빈 폼 표시 |
| Submitting | 로그인 요청 중 | 버튼 disabled, `로그인 중...` 표시 |
| Validation | 이메일 형식 오류 또는 비밀번호 6자 미만 | 필드별 FormMessage 표시 |
| Error | 인증 실패 또는 예외 | inline 오류 메시지 표시 |
| Authenticated | session이 있는 사용자가 진입 | `/admin`으로 redirect |

### Validation / Text Rule

| 필드 | 규칙 | 실패 처리 |
|---|---|---|
| email | 이메일 형식 | `올바른 이메일 형식을 입력해주세요.` |
| password | 최소 6자 | `비밀번호는 최소 6자 이상이어야 합니다.` |

- 별도 최대 글자 수 제한은 확인되지 않음.

### 화면 이동

- 인증 성공 → `/admin` 진입 후 관리자 layout을 거쳐 `/admin/albums`
- 인증된 session으로 진입 → `/admin`
- 홈으로 돌아가기 → `/`

## 5. Admin 화면

## SCR-ADM-001 관리자 진입

### 기본 정보

| 항목 | 내용 |
|---|---|
| Screen ID | SCR-ADM-001 |
| 화면명 | 관리자 진입 |
| URL | `/admin` |
| 접근 범위 | Admin |
| 구현 위치 | `src/app/(admin)/admin/page.tsx`, `src/app/(admin)/admin/layout.tsx` |
| 주요 목적 | 관리자 영역의 기본 진입 경로 제공 |

### 화면 동작

- `/admin` 요청 → 관리자 layout에서 활성 session 확인 → `manage all` 권한 확인 → `/admin/albums` redirect.
- session 없음: `/admin-login` redirect.
- 권한 부족: forbidden 처리.
- 실제 UI Page: 해당 없음.

## SCR-ADM-002 앨범 관리

### 기본 정보

| 항목 | 내용 |
|---|---|
| Screen ID | SCR-ADM-002 |
| 화면명 | 앨범 관리 |
| URL | `/admin/albums` |
| 접근 범위 | Admin |
| 구현 위치 | `src/app/(admin)/admin/albums/page.tsx`, `src/features/manage-album/ui/AlbumManagerClient.tsx`, `AlbumFormDialog.tsx` |
| 주요 목적 | 앨범 목록 조회 및 생성·수정·삭제 |

### 주요 UI 구성

| UI 영역 | 표시 데이터 | 표시 조건 | 주요 인터랙션 |
|---|---|---|---|
| 검색 입력 | 앨범 이름 또는 slug | 항상 | 검색어 입력, 페이지 초기화 |
| 앨범 테이블 | ID, 이름, slug, 색상, 표시 여부, 발매일 | 목록 조회 성공 | 수정/삭제 선택 |
| 앨범 추가 버튼 | `앨범 추가` | `canManage` 가능 시 | 생성 Dialog 열기 |
| 앨범 Form Dialog | 이름, slug, 이미지 URL/업로드, 색상, 발매일, 화면 표시 | 생성/수정 시 | 저장/취소 |
| 삭제 확인 Dialog | 대상 앨범명, 하위 곡도 삭제된다는 안내 | 삭제 대상 선택 시 | 취소/삭제 |
| 페이지네이션 | 현재 페이지/전체 페이지 | 결과가 10개 초과 시 | 이전/다음 |

### 화면 상태

| 상태 | 조건 | UI 동작 |
|---|---|---|
| Loading | 초기 관리자 앨범 조회 중 | `앨범을 불러오는 중...` |
| Empty | 목록 0건 | `등록된 앨범이 없습니다.` |
| Empty 검색 | 검색 결과 0건 | `검색 결과가 없습니다.` |
| Submitting | 앨범 저장 중 | 저장 버튼 disabled 및 spinner |
| Uploading | 이미지 업로드 중 | 이미지 업로드 버튼 disabled 및 spinner |
| Deleting | 삭제 요청 중 | 삭제 버튼 disabled |
| Error | validation/API 오류 | 필드 오류 또는 form root 오류 표시; mutation 실패는 현재 공통 오류 처리 경로에 따라 피드백 |

### Validation

| 필드 | 규칙 | 실패 처리 |
|---|---|---|
| name | 비어 있지 않음 | 필드 메시지 |
| slug | 비어 있지 않음; 영문 소문자·숫자·하이픈만 허용 | 필드 메시지 |
| imgUrl | 비어 있지 않음; URL 형식 | 필드 메시지 |
| color | HEX 색상 `#RGB` 또는 `#RRGGBB` | 필드 메시지 |
| releaseDate | 선택 입력 | 필드 메시지 |
| isVisible | boolean | 필드 메시지 |

추가로 slug 중복 시 slug 필드에 `ALBUM_SLUG_ALREADY_EXISTS` 메시지를 표시한다.

### Text Rule / 화면 이동

- 별도 최대 글자 수 제한은 확인되지 않음.
- 앨범 목록의 발매일은 `ko-KR` 날짜 형식으로 표시한다.
- 이미지 업로드 허용 형식: AVIF, JPEG, PNG, WebP.
- 삭제 완료 후 목록 데이터를 갱신한다.

## SCR-ADM-003 곡 관리

### 기본 정보

| 항목 | 내용 |
|---|---|
| Screen ID | SCR-ADM-003 |
| 화면명 | 곡 관리 |
| URL | `/admin/songs` |
| 접근 범위 | Admin |
| 구현 위치 | `src/app/(admin)/admin/songs/page.tsx`, `src/features/manage-song/ui` |
| 주요 목적 | 곡 목록 조회 및 생성·수정·삭제, 가사 편집 진입 |

### 주요 UI 구성

| UI 영역 | 표시 데이터 | 표시 조건 | 주요 인터랙션 |
|---|---|---|---|
| 검색 입력 | 곡 제목, slug, 앨범명 | 항상 | 입력 시 필터 |
| 앨범 필터 | 전체 앨범 및 앨범 목록 | 항상 | 앨범별 필터 |
| 곡 테이블 | 곡 정보, 앨범, 표시 상태 등 | 목록 조회 성공 | 수정/삭제/가사 편집 |
| 곡 추가 버튼 | `곡 추가` | `canManage` 가능 시 | 생성 Dialog 열기 |
| 곡 Form Dialog | 앨범, 제목, slug, YouTube ID, 정렬 순서, 타이틀곡, 공식 응원법, 화면 표시, LRC | 생성/수정 시 | 저장/취소 |
| 삭제 확인 Dialog | 대상 곡명, 되돌릴 수 없다는 안내 | 삭제 대상 선택 시 | 취소/삭제 |
| 페이지네이션 | 현재 페이지/전체 페이지 | 결과가 15개 초과 시 | 이전/다음 |

### 화면 상태

| 상태 | 조건 | UI 동작 |
|---|---|---|
| Loading | 곡/앨범 목록 조회 중 | `로딩 중...` |
| Empty | 필터 결과 0건 | 필터 사용 시 `검색 결과가 없습니다.`, 미사용 시 `등록된 곡이 없습니다.` 표시 |
| Submitting | 곡 저장 중 | 저장 버튼 disabled 및 spinner |
| Deleting | 곡 삭제 요청 중 | 삭제 버튼 disabled |
| Error | 입력/API 오류 | 필드·LRC·form 오류 표시; mutation 오류는 공통 오류 처리 경로 |

### Validation

| 필드 | 규칙 | 실패 처리 |
|---|---|---|
| albumId | 1 이상 앨범 선택 | 필드 메시지 |
| title | 비어 있지 않음 | 필드 메시지 |
| slug | 영문 소문자·숫자·하이픈만 허용 | 필드 메시지 |
| youtubeId | 비어 있지 않음 | 필드 메시지 |
| order | 기본값 0인 숫자 | 필드 메시지 |
| lrcText | 생성 시 필수; 수정 시 선택 | 생성 시 LRC 오류 표시 |

- `hasOfficialCheer`, `isTitle`, `isVisible`은 boolean toggle이다.
- 별도 최대 글자 수 제한은 확인되지 않음.

### 화면 이동

- 가사 편집 선택 → `/admin/edit/{slug}`
- 생성/수정/삭제 성공 후 목록 데이터 갱신

## SCR-ADM-004 가사 편집

### 기본 정보

| 항목 | 내용 |
|---|---|
| Screen ID | SCR-ADM-004 |
| 화면명 | 가사 편집 |
| URL | `/admin/edit/{slug}` |
| 접근 범위 | Admin |
| 구현 위치 | `src/app/(admin)/admin/edit/[slug]/page.tsx`, `src/features/manage-lyrics/ui` |
| 주요 목적 | YouTube 영상 기준 가사·세그먼트·타이밍 편집 및 저장 |

### 주요 UI 구성

| UI 영역 | 표시 데이터 | 표시 조건 | 주요 인터랙션 |
|---|---|---|---|
| Editor Top Bar | 현재 시간, YouTube URL/ID, 오프셋, Undo/Redo, LRC Import, 저장 | 편집기 로드 완료 후 | 입력·조정·실행 |
| YouTube Player | 편집 대상 곡 영상 | 유효한 YouTube ID | 재생/일시정지 및 현재 시간 확인 |
| 가사 테이블 | Time, Lyrics, Extra, Action | lyrics 행마다 | 행 선택, 시간 수정, 속성 편집 |
| 일반 가사 편집 | 세그먼트 텍스트 | `isExtra`가 아닌 행 | 텍스트 선택 후 Echo/Reset 분리 |
| Extra 세그먼트 편집 | 텍스트, 상대 offset | Extra 행 | 텍스트/offset 수정, offset 캡처, 세그먼트 추가/삭제 |
| 모바일 페인트 편집기 | 문자별 기본/응원법/에코 mode | 모바일 편집 인터랙션 | 드래그/터치 페인팅, 완료/취소 |
| 실시간 프리뷰 레일 | 시간축 가사 세그먼트 | 편집기 하단 | 영상 시간에 따라 레일 이동 |

### 화면 상태

| 상태 | 조건 | UI 동작 |
|---|---|---|
| Loading | route 데이터 또는 lazy editor 로딩 중 | `에디터 로딩 중...` 또는 route loading 표시 |
| Default | 곡 데이터 로드 완료 | 편집기 workspace 표시 |
| Selected | 행을 클릭하여 현재 행 선택 | 선택 행 강조 및 행 offset 버튼 활성화 |
| Saving | 저장 요청 중 | 저장 버튼 disabled, `저장 중...` 표시 |
| Not Found | slug 없음 또는 대상 곡 없음 | 공통 404 화면 |
| Forbidden | 관리자 layout/ability 검사 실패 | forbidden 처리; editor는 client ability가 없으면 렌더링하지 않음 |
| Error | 저장/조회 실패 | 관리자 route error 또는 공통 mutation 오류 처리 |

### Interaction / Validation

| 항목 | 규칙 |
|---|---|
| YouTube 입력 | URL 패턴에서 영상 ID를 추출하며 추출 실패 시 입력값을 그대로 보관 |
| 행 시간 | 유효한 0 이상 시간만 반영; 잘못된 입력은 기존 표시값으로 복원 |
| 전체 offset | 모든 행의 시간을 `-0.1s` 또는 `+0.1s` 조정; 0 미만은 0으로 제한 |
| 선택 행 offset | 행 선택 시에만 버튼 활성화; 0 미만은 0으로 제한 |
| 시간 캡처 | 현재 Player 시간을 행의 시작 시간 또는 Extra 세그먼트 상대 offset으로 반영 |
| LRC Import | LRC 파싱 결과가 있으면 가사 교체; 결과가 없거나 파싱 실패 시 toast 오류 |
| 텍스트 수정 | 텍스트 저장 시 해당 행의 기존 응원법/에코 속성을 초기화 |
| 저장 | 현재 lyrics와 YouTube ID를 저장 요청; 성공 시 `저장되었습니다.` toast |

- 저장 전 변경사항을 이탈 시 경고하는 동작은 확인되지 않음.
- 별도 최대 글자 수 제한은 확인되지 않음.
- Undo/Redo는 가능한 작업이 없을 때 각각 disabled다.
- 선택 행이 없으면 선택 행 offset 버튼이 disabled다.

### 화면 이동

- 곡 관리에서 해당 곡의 편집 링크 → `/admin/edit/{slug}`
- 저장 성공 → 현재 편집 화면 유지 및 성공 toast
- 저장 실패 → 편집 화면 유지 및 오류 처리

## 6. 기존 1차 문서 정합성 이슈

- `PROC-PUB-007`의 “잘못된 정책 slug → not found” 기술이 실제 구현과 불일치한다.
- 현재 구현은 정의되지 않은 정책 slug에 대해 `privacy` 데이터를 fallback한다.
- `04-user-process-inventory.md`의 `PROC-PUB-007` 수정이 필요했으며, 본 작업에서 실제 동작에 맞게 수정 완료했다.

## 7. 확인 필요

- 공개 홈·응원법 목록에는 route 전용 `error.tsx`가 없으며, 앱 전역 `global-error.tsx`에 오류 문구와 `다시 시도하기` 동작이 구현되어 있다. 공개 목록 오류가 해당 전역 fallback으로 연결되는 세부 Next 실행 동작은 별도 확인 필요하다.
- 외부 Google Form 내부의 입력 검증과 제출 성공/실패 화면은 저장소 범위 밖이다.

## 8. 다음 단계 후보

- 상세 사용자 프로세스 Flow
- ERD / Database Definition
- API Specification
