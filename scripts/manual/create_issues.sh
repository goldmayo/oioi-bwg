#!/bin/bash

# 생성할 이슈들 배열 정의 (원하시는 이슈를 추가/수정 가능합니다)
# 형식을 맞추기 위해 EOF(Multi-line string)를 사용하여 마크다운을 그대로 입력합니다.

echo "Github 이슈 생성을 시작합니다..."

# Task 1-1
gh issue create \
  --title "[Task 1-1] In-App 브라우저 가드 및 커스텀 훅 구현" \
  --label "enhancement" \
  --body "## 목적 (Context & Why)
- 카카오톡 등 인앱 브라우저 진입 시 발생하는 스토리지 유실 및 Web Share API 버그 차단
- 유저를 기본 브라우저(Chrome, Safari)로 강제 우회시킵니다.

## 기술적 방향 (High-level How)
- \`useInAppBrowserOut\` 커스텀 훅 생성
- 무한 루프 방지를 위한 \`sessionStorage\` 제어
- 안드로이드 크롬 인텐트(\`intent://\`) 및 카카오톡 전용 스킴(\`kakaotalk://\`) 사용

## 완료 조건 (Acceptance Criteria)
- [ ] 카톡 공유 링크 클릭 시 크롬/사파리 등 외부 브라우저가 열리는가
- [ ] 우회 후 원래 누르려던 페이지 링크로 정상 연결되는가"
sleep 1

# Task 1-2
gh issue create \
  --title "[Task 1-2] 전역 레이아웃(RootLayout) 가드 부착" \
  --label "enhancement" \
  --body "## 목적 (Context & Why)
- 페이지 종류와 무관하게 모든 유입 트래픽에 대해 인앱 브라우저 체크를 수행하기 위함입니다.

## 기술적 방향 (High-level How)
- UI가 없는 \`<InAppBrowserGuard />\` 클라이언트 컴포넌트 생성
- \`src/app/layout.tsx\` 최상단 바디에 마운트

## 완료 조건 (Acceptance Criteria)
- [ ] 홈, 응원법, 더보기 등 어떤 경로로 진입하든 가드(Guard)가 즉각 발동하는가"
sleep 1

# Task 1-3
gh issue create \
  --title "[Task 1-3] 반응형 네비게이션 UI 컴포넌트 개발" \
  --label "enhancement" \
  --body "## 목적 (Context & Why)
- 75%의 모바일 유저와 24%의 데스크톱 유저 모두에게 최적의 앱 라이크(App-like) 사용성을 제공합니다.

## 기술적 방향 (High-level How)
- 모바일: 화면 하단 고정 \`BottomNav\` 컴포넌트 (fixed bottom-0)
- 데스크톱: 화면 좌측 고정 사이드바 \`LNB\` 컴포넌트 (fixed left-0)

## 완료 조건 (Acceptance Criteria)
- [ ] 브라우저 창 크기(md 브레이크포인트 등) 변경 시 네비게이션바 형태가 스무스하게 전환되는가
- [ ] 홈, 응원법, 검색, 더보기 4개의 탭이 모두 존재하는가"
sleep 1

echo "준비된 이슈 3개의 깃허브 발행이 완료되었습니다! 깃허브 웹에서 확인해보세요."
