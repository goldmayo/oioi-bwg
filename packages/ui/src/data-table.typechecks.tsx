import {
  globalFilteringFeature,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";

import { DataTable } from "./data-table";

// 공식 feature/API 타입을 Root가 any로 넓혀 소비처에 돌려주지 않는지 tsc로 확인한다.
function PaginationOnly() {
  const features = tableFeatures({ rowPaginationFeature });
  const table = useTable({ features, columns: [], data: [] });
  table.setPageIndex(0);
  // @ts-expect-error 등록하지 않은 정렬 API는 노출되지 않는다.
  table.setSorting([]);
  // @ts-expect-error 등록하지 않은 선택 상태도 노출되지 않는다.
  void table.atoms.rowSelection;
  return (
    <DataTable.Root table={table}>
      <DataTable.Pagination />
    </DataTable.Root>
  );
}

function featurePrerequisites() {
  // @ts-expect-error 전역 검색은 공식 열 필터 feature 선행 조건이 필요하다.
  return tableFeatures({ globalFilteringFeature });
}
void PaginationOnly;
void featurePrerequisites;
