import type { ReactElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createExpandedRowModel,
  createTableHook,
  rowExpandingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";

import { DataTable } from "./data-table";
import { exampleOrders, FullExample, ManualExample } from "./data-table.examples";

afterEach(cleanup);
const grid = () => screen.getByRole("table");
const rows = () =>
  Array.from(grid().querySelectorAll<HTMLTableRowElement>("tbody tr[data-row-id]"));
const ids = () => rows().map((row) => row.dataset.rowId);

describe("15개 공식 기능의 compound 조합", () => {
  it("전체 정렬·집계가 페이지 이동보다 먼저 적용된다", () => {
    render(<FullExample />);
    fireEvent.click(screen.getByRole("button", { name: "금액" }));
    expect(ids()).toEqual(["order-1", "order-2", "order-3", "order-4", "order-5"]);
    fireEvent.click(screen.getByRole("button", { name: "금액" }));
    expect(ids()[0]).toBe("order-24");
    expect(grid().querySelector("tfoot")).toHaveTextContent("3,000,000");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(ids()[0]).toBe("order-19");
    fireEvent.change(screen.getByLabelText("페이지당 행"), { target: { value: "10" } });
    expect(ids()).toHaveLength(10);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("열 필터는 자기 필터를 제외한 패싯과 전체 결과 합계를 갱신한다", () => {
    render(<FullExample />);
    fireEvent.change(screen.getByLabelText("부서 필터"), { target: { value: "개발" } });
    const status = screen.getByLabelText("상태 필터");
    expect(within(status).getByRole("option", { name: "대기 (2)" })).toBeInTheDocument();
    expect(within(status).getByRole("option", { name: "완료 (4)" })).toBeInTheDocument();
    expect(grid().querySelector("tfoot")).toHaveTextContent("920,000");
    fireEvent.change(status, { target: { value: "대기" } });
    expect(ids()).toEqual(["order-1", "order-13"]);
    expect(
      within(screen.getByLabelText("상태 필터")).getByRole("option", { name: "완료 (4)" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("이름 필터"), { target: { value: "13" } });
    expect(ids()).toEqual(["order-13"]);
  });

  it("전역 검색 초안은 제출 때만 적용하며 페이지를 초기화한다", () => {
    render(<FullExample />);
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.change(screen.getByLabelText("전역 검색"), { target: { value: "주문 24" } });
    expect(ids()).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    expect(ids()).toEqual(["order-24"]);
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
  });

  it("그룹핑·집계·펼침이 하위 행과 placeholder를 구분한다", () => {
    render(<FullExample />);
    fireEvent.click(
      within(screen.getByRole("group", { name: "그룹 기준" })).getByRole("button", {
        name: "부서",
      }),
    );
    expect(rows()).toHaveLength(3);
    expect(grid().querySelector("tbody")).toHaveTextContent("920,000");
    const expand = screen.getByRole("button", { name: "개발 그룹 펼침" });
    fireEvent.click(expand);
    expect(expand).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("checkbox", { name: "주문 01 선택" })).toBeInTheDocument();
  });

  it("선택은 고유 ID로 페이지 간 유지하고 현재 페이지 일괄 선택과 혼합 상태를 표시한다", () => {
    render(<FullExample />);
    fireEvent.click(screen.getByRole("checkbox", { name: "주문 01 선택" }));
    expect(screen.getByLabelText("현재 페이지 선택")).toHaveProperty("indeterminate", true);
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText("1개 선택")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("현재 페이지 선택"));
    expect(screen.getByText("6개 선택")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(screen.getByRole("checkbox", { name: "주문 01 선택" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "선택 해제" }));
    expect(screen.getByText("0개 선택")).toBeInTheDocument();
  });

  it("열 순서·표시·고정·너비가 헤더·셀·푸터에 함께 반영된다", () => {
    render(<FullExample />);
    fireEvent.click(screen.getByText("열 설정", { selector: "summary" }));
    fireEvent.click(screen.getByRole("button", { name: "금액 앞으로" }));
    expect(within(grid()).getAllByRole("columnheader")[3]).toHaveTextContent("금액");
    fireEvent.click(screen.getByRole("checkbox", { name: "상태" }));
    expect(within(grid()).queryByRole("button", { name: "상태" })).not.toBeInTheDocument();
    expect(rows()[0].cells).toHaveLength(5);
    fireEvent.change(screen.getByRole("spinbutton", { name: "금액 너비" }), {
      target: { value: "250" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "금액 고정" }), {
      target: { value: "end" },
    });
    const amount = within(grid())
      .getAllByRole("columnheader")
      .find((header) => header.textContent?.includes("금액"));
    expect(amount).toHaveStyle({ width: "250px", position: "sticky", insetInlineEnd: "0px" });
    expect(rows()[0].cells[rows()[0].cells.length - 1]).toHaveTextContent("10,000");
    expect(grid().querySelector("tfoot tr")?.lastElementChild).toHaveTextContent("3,000,000");
  });

  it("열 리사이즈는 마우스·터치·키보드와 min/max를 지원한다", async () => {
    render(<FullExample />);
    const handle = screen.getByRole("separator", { name: "금액 크기 조절" });
    fireEvent.mouseDown(handle, { clientX: 200, button: 0 });
    fireEvent.mouseMove(document, { clientX: 240 });
    fireEvent.mouseUp(document, { clientX: 240 });
    await waitFor(() => expect(handle).toHaveAttribute("aria-valuenow", "190"));
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle).toHaveAttribute("aria-valuenow", "200");
    fireEvent.touchStart(handle, { touches: [{ clientX: 200 }] });
    fireEvent.touchMove(document, { touches: [{ clientX: 220 }], cancelable: true });
    fireEvent.touchEnd(document, { touches: [] });
    await waitFor(() => expect(handle).toHaveAttribute("aria-valuenow", "220"));
    fireEvent.click(screen.getByText("열 설정", { selector: "summary" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "금액 너비" }), {
      target: { value: "900" },
    });
    expect(handle).toHaveAttribute("aria-valuenow", "500");
  });

  it("행 고정은 현재 페이지 안에서 위·아래에 중복 없이 표시한다", () => {
    render(<FullExample />);
    fireEvent.change(screen.getByLabelText("주문 03 행 고정"), { target: { value: "top" } });
    expect(ids()[0]).toBe("order-3");
    expect(ids().filter((id) => id === "order-3")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("주문 03 행 고정"), { target: { value: "bottom" } });
    expect(ids().at(-1)).toBe("order-3");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(ids()).not.toContain("order-3");
  });

  it("데이터·columns/options 변경은 좁은 hook selector에서도 새 값을 반영한다", () => {
    const { rerender } = render(<FullExample />);
    rerender(<FullExample data={[{ ...exampleOrders[0], name: "변경된 주문" }]} />);
    expect(screen.getByText("변경된 주문")).toBeInTheDocument();
    fireEvent.click(screen.getByText("열 설정", { selector: "summary" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "상태" }));
    rerender(<FullExample data={[]} />);
    expect(screen.getByText("검색 결과가 없습니다.")).toHaveAttribute("colspan", "5");
  });

  it("manual 구성은 서버 rowCount·전체 totals·facets와 controlled 페이지 상태를 사용한다", () => {
    render(<ManualExample />);
    expect(rows()).toHaveLength(2);
    expect(screen.getByText("1 / 20")).toBeInTheDocument();
    expect(grid().querySelector("tfoot")).toHaveTextContent("9,990,000");
    expect(screen.getByRole("option", { name: "개발 (70)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText("2 / 20")).toBeInTheDocument();
    expect(rows()).toHaveLength(2);
  });
});

const plainFeatures = tableFeatures({});
const plainColumn = createColumnHelper<typeof plainFeatures, { value: string }>();
const plainColumns = plainColumn.columns([plainColumn.accessor("value", { header: "값" })]);
const plainData = [{ value: "외부 표" }];
function PlainExample({ nested = false }: { nested?: boolean }) {
  const table = useTable({ features: plainFeatures, columns: plainColumns, data: plainData });
  return (
    <DataTable.Root table={table}>
      <DataTable.Table caption="기본 표">
        <DataTable.Header />
        <DataTable.Body />
      </DataTable.Table>
      <DataTable.Search />
      <DataTable.Selection />
      <DataTable.Pagination />
      {nested ? <ManualExample /> : null}
      <DataTable.Table caption="같은 외부 표">
        <DataTable.Body />
      </DataTable.Table>
    </DataTable.Root>
  );
}
it("feature 없는 표와 중첩된 다른 feature 표가 서로의 context를 침범하지 않는다", () => {
  render(<PlainExample nested />);
  expect(
    within(screen.getByRole("table", { name: "기본 표" })).getByText("외부 표"),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("table", { name: "같은 외부 표" })).getByText("외부 표"),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("전역 검색")).not.toBeInTheDocument();
  expect(screen.getAllByRole("navigation")).toHaveLength(1);
});

const displayFeatures = tableFeatures({
  columnVisibilityFeature,
  columnPinningFeature,
  columnSizingFeature,
});
const displayColumn = createColumnHelper<
  typeof displayFeatures,
  { value: string; status: string }
>();
const displayColumns = displayColumn.columns([
  displayColumn.accessor("value", { header: "이름", size: 100 }),
  displayColumn.accessor("status", { header: "상태", size: 120 }),
]);
const displayData = [{ value: "항목", status: "완료" }];
function DisplayExample() {
  const table = useTable({ features: displayFeatures, columns: displayColumns, data: displayData });
  return (
    <DataTable.Root table={table}>
      <DataTable.Columns>
        <DataTable.ColumnVisibility columnId="status" />
        <DataTable.ColumnPin columnId="value" />
      </DataTable.Columns>
      <DataTable.Table caption="표시 구성">
        <DataTable.Header />
        <DataTable.Body />
      </DataTable.Table>
      <DataTable.Table caption="소비처 본문">
        <DataTable.Header>
          <DataTable.Row>
            <DataTable.Head>알림</DataTable.Head>
          </DataTable.Row>
        </DataTable.Header>
        <DataTable.Body>
          <DataTable.Row>
            <DataTable.Cell colSpan={2}>소비처가 구성한 상태</DataTable.Cell>
          </DataTable.Row>
        </DataTable.Body>
      </DataTable.Table>
    </DataTable.Root>
  );
}
it("표시·고정만 선택한 기능 집합과 소비처의 열 설정/본문 조합이 동작한다", () => {
  render(<DisplayExample />);
  fireEvent.click(screen.getByText("열 설정", { selector: "summary" }));
  expect(screen.queryByRole("checkbox", { name: "이름" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "상태" }));
  expect(
    within(screen.getByRole("table", { name: "표시 구성" })).getAllByRole("cell"),
  ).toHaveLength(1);
  fireEvent.change(screen.getByLabelText("이름 고정"), { target: { value: "start" } });
  expect(
    within(screen.getByRole("table", { name: "표시 구성" })).getByRole("columnheader", {
      name: "이름",
    }),
  ).toHaveStyle({ position: "sticky", insetInlineStart: "0px" });
  expect(screen.getByText("소비처가 구성한 상태")).toHaveAttribute("colspan", "2");
});

type TreeItem = { id: string; children?: TreeItem[] };
const treeFeatures = tableFeatures({
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
});
const treeColumn = createColumnHelper<typeof treeFeatures, TreeItem>();
const treeColumns = treeColumn.columns([
  treeColumn.accessor("id", {
    header: "이름",
    cell: ({ row }) => <DataTable.ExpandRow rowId={row.id} label={row.original.id} />,
  }),
]);
const treeData: TreeItem[] = [{ id: "상위", children: [{ id: "하위" }] }];
function TreeExample() {
  const table = useTable({
    features: treeFeatures,
    columns: treeColumns,
    data: treeData,
    getRowId: (row) => row.id,
    getSubRows: (row) => row.children,
  });
  return (
    <DataTable.Root table={table}>
      <DataTable.Table caption="하위 행">
        <DataTable.Header />
        <DataTable.Body />
      </DataTable.Table>
    </DataTable.Root>
  );
}
it("그룹핑 없이 독립된 펼침 부품으로 하위 행을 열고 닫는다", () => {
  render(<TreeExample />);
  fireEvent.click(screen.getByRole("button", { name: "상위" }));
  expect(screen.getByRole("button", { name: "하위" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "상위" }));
  expect(screen.queryByRole("button", { name: "하위" })).not.toBeInTheDocument();
});

function RegisteredCount(): ReactElement {
  const table = registered.useTableContext();
  return <output>소비처 도구 {table.options.data.length}행</output>;
}
const registered = createTableHook({
  features: plainFeatures,
  tableComponents: { Count: RegisteredCount },
});
function RegisteredExample() {
  const table = registered.useAppTable({ columns: plainColumns, data: plainData });
  return (
    <table.AppTable>
      <DataTable.Root table={table}>
        <DataTable.Toolbar>
          <table.Count />
        </DataTable.Toolbar>
        <DataTable.Table caption="등록 부품 조합">
          <DataTable.Header />
          <DataTable.Body />
        </DataTable.Table>
      </DataTable.Root>
    </table.AppTable>
  );
}
it("소비처의 공식 createTableHook 등록 부품과 compound UI를 함께 조합한다", () => {
  render(<RegisteredExample />);
  expect(screen.getByText("소비처 도구 1행")).toBeInTheDocument();
  expect(within(grid()).getByText("외부 표")).toBeInTheDocument();
});
