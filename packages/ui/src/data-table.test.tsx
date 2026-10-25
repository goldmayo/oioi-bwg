import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { createAppColumnHelper, useAppTable } from "./data-table";

type Item = { id: number; name: string };
const helper = createAppColumnHelper<Item>();
const columns = helper.columns([
  helper.accessor("id", { header: "번호", sortFn: "basic" }),
  helper.accessor("name", { header: "이름" }),
]);
const items = [
  { id: 3, name: "다" },
  { id: 1, name: "가" },
  { id: 2, name: "나" },
];
function Fixture({ data }: { data: Item[] }) {
  const table = useAppTable({
    data,
    columns,
    getRowId: (row) => String(row.id),
    initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
  });
  return (
    <table.AppTable>
      <table.Body caption="예제 목록" emptyState="일치하는 항목이 없습니다." />
      <table.Pagination />
    </table.AppTable>
  );
}
afterEach(cleanup);

describe("Data Table 사용자 동작", () => {
  it("키보드 정렬이 전체 목록에 적용된 뒤 페이지를 이동한다", async () => {
    const user = userEvent.setup();
    render(<Fixture data={items} />);
    expect(screen.getByRole("button", { name: "이전" })).toBeDisabled();
    screen.getByRole("button", { name: "번호" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("columnheader", { name: /번호/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[0].textContent),
    ).toEqual(["1", "2"]);
    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText("다")).toBeInTheDocument();
    expect(screen.queryByText("가")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
  });

  it("마지막 페이지에서 검색·삭제로 데이터가 줄면 유효한 페이지로 돌아온다", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Fixture data={items} />);
    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    rerender(<Fixture data={[items[0]]} />);
    await waitFor(() => expect(screen.getByText("1 / 1")).toBeInTheDocument());
    expect(screen.getByText("다")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
  });

  it("빈 결과에서 표 이름과 안내를 유지하고 페이지 이동을 차단한다", () => {
    render(<Fixture data={[]} />);
    expect(screen.getByRole("table", { name: "예제 목록" })).toBeInTheDocument();
    expect(screen.getByText("일치하는 항목이 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이전" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
  });
});
