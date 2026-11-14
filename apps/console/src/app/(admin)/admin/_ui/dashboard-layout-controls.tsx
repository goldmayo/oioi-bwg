"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

import { useMediaQuery } from "@/shared/model/useMediaQuery";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";

import { type DashboardLayout, type WidgetId, widgetLabels } from "../_model/dashboard-layout";

export function DashboardLayoutControls({
  layout,
  dirty,
  notice,
  onToggle,
  onMove,
  onReset,
  onSave,
}: {
  layout: DashboardLayout;
  dirty: boolean;
  notice?: "saved" | "error";
  onToggle: (id: WidgetId) => void;
  onMove: (from: number, to: number) => void;
  onReset: () => void;
  onSave: () => void;
}) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const visible = layout.mobile.filter((id) => !layout.hidden.includes(id));

  return (
    <div className="border-border bg-card space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">위젯 설정</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={onReset}>
            기본 배치
          </Button>
          <Button type="button" disabled={!dirty} onClick={onSave}>
            저장
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground text-sm">
        {desktop
          ? "제목을 끌어 이동하고 오른쪽 아래 모서리로 크기를 조절합니다."
          : "위·아래 버튼으로 표시할 위젯의 순서를 바꿉니다."}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[...visible, ...layout.hidden].map((id) => {
          const index = visible.indexOf(id);
          return (
            <li
              key={id}
              className="border-border flex min-w-0 items-center justify-between gap-2 rounded-md border px-2.5"
            >
              <label className="flex min-h-11 min-w-0 items-center gap-2 text-sm">
                <Checkbox
                  checked={index !== -1}
                  disabled={index !== -1 && visible.length === 1}
                  onCheckedChange={() => onToggle(id)}
                />
                {widgetLabels[id]}
              </label>
              {!desktop && index !== -1 && (
                <div className="flex shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={widgetLabels[id] + " 위로 이동"}
                    disabled={index === 0}
                    onClick={() => onMove(index, index - 1)}
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={widgetLabels[id] + " 아래로 이동"}
                    disabled={index === visible.length - 1}
                    onClick={() => onMove(index, index + 1)}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {notice === "saved" && (
        <p role="status" className="text-sm">
          배치를 저장했습니다.
        </p>
      )}
      {notice === "error" && (
        <p role="alert" className="text-destructive text-sm">
          배치를 저장하지 못했습니다. 브라우저 저장 설정을 확인해 주세요.
        </p>
      )}
    </div>
  );
}
