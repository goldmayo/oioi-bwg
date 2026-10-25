---
title: "공용 Data Table의 15개 기능과 compound 구성 복원 계획"
kind: migration-plan
status: active
source_commit: b1bc8256ef8a99aad2f859be762b00397e181a09
created_at: "2026-10-25"
---

# 범위와 정정 근거

사용자는 원본 `tanstack-v9-15-features-example/README.md`의 15개 공식 기능과 소비처의
compound component 조합을 요구했다. #251의 두 기능 고정 팩토리는 이 요구를 충족하지 못했다.
[기존 결과](CONSOLE-DATA-TABLE-RESULT.md)의 부분 수용은 당시 구현 이력으로 보존한다.
원본은 `/mnt/c/Users/dudto/OneDrive/Desktop/사이드프로젝트/tanstack-v9-15-features-example`이며
수정하지 않는다. 기준 저장소는 `goldmayo/oioi-bwg`, 위 source commit이다.

상위 기준은 [헌법 §5](../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md#5-최상위-디렉터리),
[Frontend §2](../oioi-bwg-architecture-clean-v1/02-frontend-architecture.md#2-기본-구조)다.
이번 사용자 정정에 따라 두 기능으로 공용 UI를 제한한 문구를 먼저 개정한다.

# 구현

- `DataTable.Root`는 소비처의 공식 `useTable`/`createTableHook` 결과를 받는다. 정적 feature 집합,
  client 행 모델 또는 manual 처리, `ColumnDef`, `state/on*Change`는 소비처가 선택한다.
- 공식 context와 `Subscribe`만 사용한다. Controller/Plugin/Capability DSL이나 별도 상태 저장소를 만들지 않는다.
  context에서 지워지는 feature/row generic은 내부 표시 경계에 한정한다. UI는 등록 여부를 확인하며,
  소비처의 공식 table API와 feature 선행 조건 타입 검사는 유지한다.
- `Table/Header/Body/Footer`, `Toolbar/Search/Filter/Grouping/Selection/Columns/Pagination`,
  행 선택·펼침·고정 부품을 독립 조합한다. 15개 기능의 표시를 실제로 연결한 예제를 제공한다.
- 정렬, 열 필터, 전역 검색, 패싯, 페이징, 행 선택, 펼침, 그룹핑, 집계, 열 순서·고정·표시·너비·리사이즈,
  행 고정을 지원한다. 셀 범위 선택·병합은 원본 제외 범위를 유지한다.
- 표시 셀/빈 결과 colspan, 그룹/집계/placeholder, sticky 열 offset, 고정 행 중복 방지,
  stable table 객체의 state/options 갱신과 keyboard/touch resize를 확인한다.
- Console 두 소비처는 앱 내부의 공식 두 기능 팩토리를 유지하면서 새 compound UI를 조합한다.
  공용 패키지의 지원 범위를 Console의 기능 수로 제한하지 않는다. 기존 권한·폼·검색·Query는 보존한다.
- URL은 앱의 nuqs, 사용자별 열 설정 저장은 앱 정책으로 연결한다. 공용 UI에서 history/localStorage에
  직접 쓰거나 서버 조회 계약을 만들지 않는다. manual 예제로 서버 페이징을 현재 페이지의 client 집계와 구분한다.

# 완료 조건과 검증

1. package README에 기본 조합, 15개 기능 대응표, 최소 feature·manual 조합과 상태 소유권을 기록한다.
2. UI 테스트에서 15개 기능과 기능 간 상호작용, 부분 feature 구성, controlled 상태, sibling/nested context를 검증한다.
3. Console의 Compiler 권한 회수·DTO/callback 갱신 회귀를 유지하고 desktop/mobile 브라우저에서 확인한다.
4. `pnpm type-check`, `pnpm test:harness`, `pnpm lint`, `pnpm lint:fsd`, `pnpm test:unit:run`,
   `pnpm format:check`, `NEXT_PUBLIC_APP_ENV=local pnpm build`와 ops를 실행한다.
5. [후속 결과](COMPOSABLE-DATA-TABLE-RESULT.md)에 실제 검증과 커밋/PR을 기록한 뒤 commit → push → PR을 진행한다.

하나의 공용 compound 계약과 두 실제 consumer·15개 기능 예제가 함께 검증돼야 하므로 400줄을 넘을 수 있다.
리뷰 순서는 상위 계약 → 공용 context/표/조작 부품 → 예제·상호작용/타입 검사 → Console 전환 → 결과다.
이번 범위에는 운영 배포·DB/schema·회원/인증 정책·다른 UI primitive의 Base UI 전환을 추가하지 않는다.

# 실행 중 사용자 보완

사용자는 버튼을 소비처에서 주입하고 생략 시 내부 기본 구현을 사용하도록 보완했다.
`Root components.Button`은 native button props 계약을 받고 모든 조작 부품에 적용한다.
기능 이벤트·접근성·기본 스타일은 공용 부품이 소유하며 Console은 기존 앱 Button을 주입한다.
주입 시 정렬/검색/페이징/그룹 동작과 ref 전달, 중첩/형제 Root의 기본값 격리를 추가로 검증한다.
설치는 저장소 루트의 `pnpm install --frozen-lockfile`로 잠금파일과 일치시키며
두 UI tsconfig의 CLI 타입 검사와 IDE 오류를 구분한다.
