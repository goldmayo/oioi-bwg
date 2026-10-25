# @oioi-bwg/ui — Data Table

TanStack Table **9.1.2**의 공식 기능과 소비처가 조합하는 compound UI다.
기능/행 모델은 소비처의 `tableFeatures`, 열은 `ColumnDef`, 상태는 `state/on*Change` 또는 공식 atoms가 소유한다.
`DataTable.Root`는 `useTable`이나 `createTableHook`이 반환한 table을 받는다.

## 기본 조합

소비 workspace는 `@tanstack/react-table@9.1.2`를 직접 의존성으로 선언한다.
다음은 정렬·페이징만 사용하는 완전한 예제다. 다른 기능을 모든 표에 강제하지 않는다.

```tsx
"use client";

import {
  createPaginatedRowModel,
  createSortedRowModel,
  createTableHook,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";
import { DataTable } from "@oioi-bwg/ui/data-table";

const { useAppTable, createAppColumnHelper } = createTableHook({
  features: tableFeatures({
    rowSortingFeature,
    rowPaginationFeature,
    sortedRowModel: createSortedRowModel(),
    paginatedRowModel: createPaginatedRowModel(),
    sortFns: { text: sortFn_text },
  }),
  defaultColumn: { sortFn: "text", sortDescFirst: false },
});
type Item = { id: string; name: string };
const column = createAppColumnHelper<Item>();
const columns = column.columns([column.accessor("name", { header: "이름" })]);

export function Items({ items }: { items: Item[] }) {
  const table = useAppTable({ columns, data: items, getRowId: (row) => row.id });
  return (
    <DataTable.Root table={table}>
      <DataTable.Table caption="항목 목록">
        <DataTable.Header />
        <DataTable.Body emptyState="등록된 항목이 없습니다." />
      </DataTable.Table>
      <DataTable.Pagination pageSizes={[10, 20, 50]} />
    </DataTable.Root>
  );
}
```

## 15개 기능 조합

[실행·타입 검사되는 FullExample](src/data-table.examples.tsx)은 원본 예제의 15개 기능을 모두 연결한다.
공식 기능 집합과 client 행 모델을 별도로 선언하고 아래처럼 UI를 배치한다.
열별 필터/표시 이름은 `metaHelper<DataTableColumnMeta>()`로 선언한다. 정렬·집계·너비 옵션은 공식
`ColumnDef` 필드에 둔다.

```tsx
<DataTable.Root table={table}>
  <DataTable.Toolbar>
    <DataTable.Search />
    <DataTable.Filter columnId="department" />
    <DataTable.Grouping />
    <DataTable.Selection />
  </DataTable.Toolbar>
  <DataTable.Columns />
  <DataTable.Table caption="주문 목록">
    <DataTable.Header />
    <DataTable.Body />
    <DataTable.Footer />
  </DataTable.Table>
  <DataTable.Pagination pageSizes={[5, 10, 20]} />
</DataTable.Root>
```

| 기능        | 소비처의 공식 등록                 | 조합 부품과 연결                                              |
| ----------- | ---------------------------------- | ------------------------------------------------------------- |
| 정렬        | `rowSortingFeature`                | `Header`의 정렬 버튼, `aria-sort`                             |
| 열 필터     | `columnFilteringFeature`           | `Filter columnId`, `column.setFilterValue`                    |
| 전역 검색   | `globalFilteringFeature` + 열 필터 | `Search`: 초안과 제출을 구분하고 페이지 초기화                |
| 패싯        | `columnFacetingFeature`            | `Filter`의 select 변형, 값·건수, 자기 열 필터 제외            |
| 페이징      | `rowPaginationFeature`             | `Pagination`: 이전/다음·페이지 수·선택적 page size            |
| 행 선택     | `rowSelectionFeature`              | `RowSelect`, `Selection`: 현재 페이지 선택·전체 선택 수·해제  |
| 펼침        | `rowExpandingFeature`              | `ExpandRow`, `Body`의 그룹 펼침                               |
| 그룹핑      | `columnGroupingFeature`            | `Grouping`, 그룹/placeholder 셀 분리                          |
| 집계        | `rowAggregationFeature`            | `Body`의 `aggregatedCell`, `Footer`의 전체 집계               |
| 열 순서     | `columnOrderingFeature`            | `ColumnOrder`: 접근 가능한 앞/뒤 버튼                         |
| 열 고정     | `columnPinningFeature`             | `ColumnPin`, 헤더/본문/푸터 순서; sizing과 함께 sticky offset |
| 열 표시     | `columnVisibilityFeature`          | `ColumnVisibility`, 표시 셀과 빈 결과 colspan                 |
| 열 너비     | `columnSizingFeature`              | `ColumnWidth`, `size/minSize/maxSize`, 표 전체 너비           |
| 열 리사이즈 | `columnResizingFeature` + sizing   | `Header` 손잡이의 mouse/touch·좌우 화살표                     |
| 행 고정     | `rowPinningFeature`                | `RowPin`, `Body`의 위/중앙/아래 중복 없는 렌더                |

`Columns`는 표시·순서·고정·너비의 기본 조합이다. 필요한 열/부품만 배치할 수 있다.

```tsx
<DataTable.Columns label="표 표시 설정">
  <DataTable.ColumnVisibility columnId="status" />
  <DataTable.ColumnOrder columnId="status" />
  <DataTable.ColumnPin columnId="name" />
  <DataTable.ColumnWidth columnId="name" />
</DataTable.Columns>
```

`Header`, `Body`, `Footer`에 children을 주면 해당 구역을 직접 구성한다.
`Head/Row/Cell`은 native HTML props를 유지한다. 예를 들어 로딩·실패 상태도 소비처가 표현할 수 있다.

```tsx
<DataTable.Body>
  <DataTable.Row>
    <DataTable.Cell colSpan={3}>목록을 불러오는 중입니다.</DataTable.Cell>
  </DataTable.Row>
</DataTable.Body>
```

행 열 정의에서는 `<DataTable.RowSelect rowId={row.id} label="행 선택" />`,
`<DataTable.RowPin rowId={row.id} label="행 고정" />`을 사용할 수 있다.
그룹 행의 선택·고정 여부는 소비처의 `enableRowSelection/enableRowPinning` 옵션으로 정한다.

소비처가 `createTableHook`의 `tableComponents`와 그 팩토리의 `useTableContext`도 사용한다면
공식 `<table.AppTable>` 안에 `DataTable.Root`를 배치한다. 해당 등록 부품은 공식 provider를 읽고,
공용 compound 부품은 Root의 표시 context를 읽는다. 이 조합도 회귀 테스트에 포함한다.

## 상태와 서버 처리

- 공유 가능한 검색/정렬/필터/그룹/페이지 상태는 소비 앱에서 nuqs와 공식 `state/on*Change`로 연결한다.
  열 설정 저장 키·계정 격리·로그아웃 정리는 앱 정책이다. UI package는 URL/storage를 변경하지 않는다.
- `FullExample`은 controlled 열 표시와 내부 transient 상태를 함께 사용한다. 선택 수는 `rowSelection`의
  true인 고유 ID 수이며 페이지에 있는 `getSelectedRowModel()`의 행 수로 대신하지 않는다.
- 전건 데이터의 계산은 `createFilteredRowModel`/`createGroupedRowModel`/`createSortedRowModel`/
  `createExpandedRowModel`/`createPaginatedRowModel`과 facet factory로 연결한다.
- [ManualExample](src/data-table.examples.tsx)은 client 행 모델을 등록하지 않고 `manual*`, 서버 `rowCount`,
  `getAggregationValue` totals와 `facetedUniqueValues` factory를 사용한다. 서버 일부 페이지를 전체 결과로
  정렬/집계하지 않는다. 실제 Query·API·URL, 지원하는 서버 조건과 이전 결과 사용 정책은 앱이 구현한다.
- 행 고정을 현재 페이지 안에서만 표시하려면 `keepPinnedRows: false`를 사용한다. 별도 viewport sticky row
  정책은 없다. 열의 sticky offset에는 `columnPinningFeature`와 `columnSizingFeature`가 함께 필요하다.

## 타입·구독·경계

공식 `tableFeatures`의 선행 조건과 미등록 API 타입 제한은 그대로 유지한다.
React context에서 사라지는 generic은 Root 내부 표시 경계에서만 지우며, 모든 선택 API는 등록 여부를
확인한다. 미등록 기능의 조작 부품은 렌더하지 않는다. 중첩/형제 Root는 각각 자신의 table을 읽는다.
별도 Controller/Plugin/Capability/Column DSL과 두 번째 상태 저장소는 없다.

표시 부품은 공식 state와 options store를 구독한다. 좁은 `useTable` selector에서도 상태·새 DTO·열 callback
갱신을 확인하며 React Compiler를 적용한 UI/Console 회귀 검사를 실행한다. 기존 Console consumer의
`use no memo`는 검증된 호환 경계로 보존한다. 전 상태 구독을 사용하는 현재 표는 대용량 최적화 증거가 아니다.

스타일은 소비 앱의 semantic Tailwind token을 사용한다. 앱은 UI source를 transpile하고 Tailwind `@source`에
등록한다. domain/권한/Query/폼·Next runtime·server/contracts는 이 package에 넣지 않는다.

원본은 사용자 제공 `tanstack-v9-15-features-example/README.md`와 source다.
[공식 기능](https://tanstack.com/table/latest/docs/guide/features),
[공식 조합](https://tanstack.com/table/latest/docs/framework/react/guide/composable-tables),
[공식 Compiler 구독](https://tanstack.com/table/latest/docs/framework/react/guide/react-compiler)을 따른다.
셀 범위 선택·병합은 원본 제외 범위를 유지한다.
