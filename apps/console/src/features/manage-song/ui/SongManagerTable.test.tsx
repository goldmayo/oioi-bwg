import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { AdminSongSummary } from "@/entities/song";

import { SongManagerTable } from "./SongManagerTable";

afterEach(cleanup);
const song: AdminSongSummary = {
  id: "019a0170-0000-7000-8000-000000000001",
  albumId: "019a0170-0000-7000-8000-000000000002",
  album: { name: "앨범" },
  title: "곡 A",
  slug: "song-a",
  youtubeId: "pbELDkeLdho",
  hasOfficialCheer: false,
  isTitle: false,
  isVisible: true,
  order: 1,
  updatedAt: "2026-10-31",
};
it("실제 테이블 체크박스는 제어된 선택을 갱신하고 권한 회수 시 비활성화한다", () => {
  const change = vi.fn();
  function Table({ canManage }: { canManage: boolean }) {
    const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
    return (
      <SongManagerTable
        songs={[song]}
        selectedIds={selected}
        onSelect={(id, checked) => {
          change(id, checked);
          setSelected(checked ? new Set([id]) : new Set());
        }}
        canManage={canManage}
        hasFilter={false}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    );
  }
  const view = render(<Table canManage />);
  const checkbox = screen.getByRole("checkbox", { name: "곡 A 선택" });
  expect(checkbox.getAttribute("aria-checked")).toBe("false");
  fireEvent.click(checkbox);
  expect(change).toHaveBeenLastCalledWith(song.id, true);
  expect(screen.getByRole("checkbox", { name: "곡 A 선택" }).getAttribute("aria-checked")).toBe(
    "true",
  );
  view.rerender(<Table canManage={false} />);
  expect(screen.getByRole("checkbox", { name: "곡 A 선택" }).hasAttribute("disabled")).toBe(true);
});
