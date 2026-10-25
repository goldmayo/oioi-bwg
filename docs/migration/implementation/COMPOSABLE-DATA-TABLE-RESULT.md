---
title: "공용 Data Table의 15개 기능과 compound 구성 복원 결과"
kind: migration-result
status: completed
source_commit: 9434a20746ea408d6b10aa6b31e132b9a44cf77e
created_at: "2026-10-25"
---

# 범위와 근거

`goldmayo/oioi-bwg`의 `migration_main` `b1bc8256ef8a99aad2f859be762b00397e181a09`에서
`feature/composable-data-table`을 분기했다. 사용자가 요구한 15개 기능·소비처 compound 구성과
버튼 주입을 구현했다. [계획](COMPOSABLE-DATA-TABLE-PLAN.md)을 완료하며
[#251 결과](CONSOLE-DATA-TABLE-RESULT.md)는 당시 두 기능 구현·배포 이력으로 보존한다.
헌법 §5, Frontend §2와 문서 인덱스의 공용 테이블 범위를 함께 정정했다.

원본은 사용자 제공 `C:\Users\dudto\OneDrive\Desktop\사이드프로젝트\tanstack-v9-15-features-example`이다.
WSL에서 같은 위치의 README와 source를 읽었으며 원본은 변경하지 않았다.
`src` 파일을 이름순으로 상대 이름 + NUL + 내용으로 계산한 SHA256은
`cf20164dad61eae9e947bcbda7aff9a2f91a963d85ed51795419d22415ab021d`,
README SHA256은 `c083c83e25f2eb719ce87420911e0bd65cb4494a26a96cc5f966767503680a17`이다.

# 구현과 소비처

- `packages/ui`는 `DataTable.Root/Table/Header/Body/Footer`, 구조 부품, 도구·검색·필터·그룹·선택·
  열 설정·페이지 부품을 독립 제공한다. 기능별 조작 부품은 등록한 공식 feature에만 접근한다.
- 소비처는 TanStack Table **9.1.2**의 `tableFeatures`, `createTableHook` 또는 `useTable`,
  `ColumnDef`, client 행 모델 또는 `manual*`, `state/on*Change`를 그대로 소유한다.
  별도 Controller/Plugin/Capability/Column DSL과 추가 상태 저장소는 없다.
- 정렬, 열 필터, 전역 검색, 패싯, 페이징, 행 선택, 펼침, 그룹핑, 집계, 열 순서, 열 고정,
  열 표시, 열 너비, 열 리사이즈, 행 고정의 15개 기능을 연결했다.
  [README](../../../packages/ui/README.md)와 실행·타입 검사되는 `FullExample`에 대응 관계를 기록했다.
- 본문은 표시 열·그룹/집계/placeholder를 구분하고 고정 행 중복을 방지한다. 열 sticky offset은
  pinning+sizing 조합을 사용한다. 너비 min/max와 마우스·터치·키보드 리사이즈를 지원한다.
- `Subscribe`로 state와 options store를 구독한다. 좁은 table selector에서도 새 DTO·열 callback·
  controlled 상태가 반영되며 형제·중첩 table context가 격리된다. 공식 등록 부품도 함께 조합할 수 있다.
- `components.Button`은 소비처의 native button props 호환 컴포넌트를 받는다. 생략하거나 빈 구성이라면
  패키지 내부 기본 버튼을 사용한다. 이벤트·접근성·기본 스타일은 표 부품이 계속 소유하며
  주입 컴포넌트는 `type/disabled/aria-*/className/ref/children`과 이벤트를 실제 버튼에 전달한다.
  직접 배치하는 `DataTable.Button`에도 같은 정책이 적용된다.
- Console의 두 관리 목록은 앱 내부의 공식 정렬·페이징 팩토리와 기존 앱 Button을 사용한다.
  앨범 10행·곡 15행, 도메인 열·권한·관리 callback과 `use no memo` 호환 경계를 유지한다.
  공용 UI 지원 범위를 두 목록이 선택한 기능 수로 제한하지 않는다.
- manual 예제는 client 행 모델 없이 서버 rowCount·전체 totals·facets와 controlled 페이지를 사용한다.
  일부 페이지를 전건으로 정렬·집계하지 않는다. URL은 앱의 nuqs, 계정별 열 설정 저장은 앱 정책이다.
  셀 범위 선택·병합은 원본 제외 범위를 유지한다.

# 검증

- 저장소 루트의 `pnpm install --frozen-lockfile`이 성공했다. 잠금파일은 설치 중 바뀌지 않았다.
  `pnpm --filter @oioi-bwg/ui type-check`는 `tsconfig.json`과 `tsconfig.config.json` 모두 통과했다.
  사용자가 본 IDE 진단은 TypeScript 서버 재시작으로 사라져 해당 설정을 변경하지 않았다.
- `pnpm --filter @oioi-bwg/ui test`: React Compiler를 적용한 2개 파일의 **19건** 통과.
  15개 기능과 상호작용, 부분 feature, controlled/manual 구성, 공식 등록 부품,
  주입 버튼의 동작·비활성/제출 속성·접근성·ref·중첩 기본값 격리를 포함한다.
  `.typechecks.tsx`는 미등록 기능 API와 공식 선행 조건의 타입 오류가 유지되는지 확인한다.
- 최종 `pnpm verify`가 exit 0으로 완료됐다. 실행 환경은 다음과 같다.

  ```bash
  PATH="$PWD/.local/p06-c/bin:$PATH" \
  NEXT_PUBLIC_APP_ENV=local \
  DATABASE_URL=postgresql://local:local@127.0.0.1:1/local \
  NEXT_PUBLIC_SENTRY_DSN= NEXT_PUBLIC_GTM_ID= \
  SENTRY_AUTH_TOKEN= SENTRY_SOURCE_MAPS_ENABLED=false \
  NEXT_TELEMETRY_DISABLED=1 pnpm verify
  ```

  `.local/p06-c/bin`은 기존 로컬 jq 경로다. 타입·lint/FSD·단위의 20 task는 이전 성공 결과를
  재사용했다. 단위 합계는 **727건**(Web 184, Console 375, server 114, contracts 3, relay 32,
  UI 19)이다. 저장소 타입/lint·의존 경계, Turbo boundaries 459개 파일/8개 package,
  harness **46/46**, ops **287/287**, format이 통과했다.
  Web·Console standalone build 모두 성공했으며 최종 build는 2 task 중 Web 1개가 cache hit였다.
  두 앱의 standalone `server.js`도 확인했다.
- 최종 전체 검사 전 파일 확장자 변경이 Git 인덱스에 반영되지 않아 의존 검사에서 이전 `.ts`를 찾는
  실패가 있었다. 변경을 stage한 뒤 위 전체 검사를 완료했으며 검사 도구는 변경하지 않았다.
- Chromium에서 React Compiler와 실제 Console CSS·두 관리 table component를 묶은 격리 fixture로
  1440px/390px **40개 조건**, 브라우저 예외 **0건**을 확인했다. 정렬·페이지·검색·필터·패싯·집계·
  그룹/펼침·선택·행 고정·열 순서/표시/고정/너비·키보드/터치 리사이즈, 페이지 행 callback,
  권한 회수·새 DTO/callback과 문서 가로 넘침을 확인했다. Console은 주입 버튼을 사용했다.
- fixture 목록은 메모리 데이터이며 Next Link만 anchor adapter로 대체했다.
  실제 로그인·DB E2E 또는 Next navigation 검증으로 세지 않는다.
- 변경 UI의 `impeccable detect --json` 1회 결과는 finding 0건이었다.
  `git diff --check`와 최종 문서 상대 링크를 확인했다.

![15개 기능 desktop fixture](assets/composable-data-table/features-1440.png)

![15개 기능 mobile fixture](assets/composable-data-table/features-390.png)

![Console desktop fixture — 앱 Button 주입](assets/composable-data-table/console-1440.png)

![Console mobile fixture — 앱 Button 주입](assets/composable-data-table/console-390.png)

# 변경 단위와 남은 범위

공용 compound 계약·15개 기능·예제/회귀와 두 실제 consumer 전환을 함께 검증하므로
20개 파일/400줄 목표를 넘는다. 리뷰 순서는 상위 계약 → context/구조/조작 부품 →
예제·타입/상호작용 검사 → Console 전환 → 결과다. 무관한 설정·의존성 정리는 포함하지 않았다.
추가 Babel 개발 의존성과 workspace 직접 의존성은 Compiler 검증과 공식 소비처 API에 필요하다.

- `a6b1473db49ae5113776b166bc4bde7a9348f717`: 15개 기능과 compound 구성 복원.
- `9434a20746ea408d6b10aa6b31e132b9a44cf77e`: 소비처 버튼 주입과 내부 기본 버튼, Console 적용·회귀 보완.
- 이번 범위에서 보류한 구현은 없다. 서버 페이징 API·URL/storage 정책 확장은 각 소비 앱의 후속 요구다.
  운영 배포와 DB 변경은 수행하지 않았다. 배포는 별도 Promotion 절차를 따른다.
