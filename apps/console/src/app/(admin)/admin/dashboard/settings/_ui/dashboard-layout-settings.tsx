"use client";

import { useState } from "react";
import GridLayout, { type Layout, useContainerWidth } from "react-grid-layout";
import { ArrowDown, ArrowUp, GripHorizontal } from "lucide-react";
import Link from "next/link";

import { adminPaths } from "@/shared/config/admin-routes";
import { useMediaQuery } from "@/shared/model/useMediaQuery";
import { Button } from "@/shared/ui/button";

import {
  type DashboardLayout,
  defaultDashboardLayout,
  saveDashboardLayout,
  useSavedDashboardLayout,
  type WidgetId,
  widgetLabels,
} from "../../../_model/dashboard-layout";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const gridConfig = { cols: 6, rowHeight: 32, margin: [12, 12], containerPadding: [0, 0] } as const;
const dragConfig = { handle: "[data-widget-grip]", bounded: true };
const widgetDescriptions = {
  content: "앨범·곡 개수와 관리 링크",
  jobs: "파형 작업 결과와 알림 내역",
  analytics: "방문 추세와 유입·접속 환경",
};

export function DashboardLayoutSettings({ accountId }: { accountId: string }) {
  const saved = useSavedDashboardLayout(accountId);
  const [draft, setDraft] = useState<DashboardLayout>();
  const [notice, setNotice] = useState<"saved" | "error">();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const { width, containerRef, mounted } = useContainerWidth();
  const layout = draft ?? saved ?? defaultDashboardLayout;
  const grid = layout.desktop.map((item) => ({
    ...item,
    minW: item.i === "analytics" ? 3 : 2,
    minH: 2,
    maxH: 8,
  }));

  function updateDesktop(next: Layout) {
    const items = next.map(({ i, x, y, w, h }) => ({ i: i as WidgetId, x, y, w, h }));
    setDraft({ ...layout, desktop: items });
    setNotice(undefined);
  }

  function moveMobile(from: number, to: number) {
    const items = [...layout.mobile];
    [items[from], items[to]] = [items[to], items[from]];
    setDraft({ ...layout, mobile: items });
    setNotice(undefined);
  }

  function save() {
    try {
      saveDashboardLayout(accountId, layout);
      setDraft(undefined);
      setNotice("saved");
    } catch {
      setNotice("error");
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">대시보드 관리</h1>
        <p className="text-muted-foreground text-sm">
          위젯 배치는 이 브라우저에 계정별로 저장됩니다.
        </p>
      </header>
      <div className="border-border bg-card space-y-4 rounded-xl border p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">{desktop ? "데스크톱 배치" : "모바일 배치"}</h2>
            <p className="text-muted-foreground text-sm">
              {desktop
                ? "상단 손잡이로 이동하고 오른쪽 아래 모서리로 크기를 조절합니다."
                : "위·아래 버튼으로 위젯 순서를 바꿉니다."}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-11 md:h-9"
            onClick={() => {
              setDraft(defaultDashboardLayout);
              setNotice(undefined);
            }}
          >
            기본 배치
          </Button>
        </div>
        <div className="lg:bg-background lg:border-border min-w-0 lg:rounded-lg lg:border lg:p-3">
          <div ref={containerRef}>
            {desktop ? (
              <>
                {mounted && (
                  <GridLayout
                    width={width}
                    layout={grid}
                    gridConfig={gridConfig}
                    dragConfig={dragConfig}
                    onDragStop={updateDesktop}
                    onResizeStop={updateDesktop}
                  >
                    {layout.desktop.map(({ i }) => (
                      <div
                        key={i}
                        data-widget={i}
                        className="bg-card border-border [&>.react-resizable-handle]:after:border-foreground/60 overflow-hidden rounded-md border"
                      >
                        <div
                          data-widget-grip
                          className="bg-muted flex h-8 cursor-grab items-center gap-2 px-2.5 active:cursor-grabbing"
                        >
                          <GripHorizontal className="size-4 shrink-0" aria-hidden="true" />
                          <span className="truncate text-sm font-medium">{widgetLabels[i]}</span>
                        </div>
                        <p className="text-muted-foreground px-2.5 py-2 text-xs">
                          {widgetDescriptions[i]}
                        </p>
                      </div>
                    ))}
                  </GridLayout>
                )}
              </>
            ) : (
              <ol className="grid gap-2">
                {layout.mobile.map((id, index) => (
                  <li
                    key={id}
                    className="border-border flex min-h-16 items-center justify-between gap-1 rounded-md border px-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{widgetLabels[id]}</p>
                      <p className="text-muted-foreground text-xs">{widgetDescriptions[id]}</p>
                    </div>
                    <div className="flex shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11"
                        aria-label={widgetLabels[id] + " 위로 이동"}
                        disabled={index === 0}
                        onClick={() => moveMobile(index, index - 1)}
                      >
                        <ArrowUp aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11"
                        aria-label={widgetLabels[id] + " 아래로 이동"}
                        disabled={index === layout.mobile.length - 1}
                        onClick={() => moveMobile(index, index + 1)}
                      >
                        <ArrowDown aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
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
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" className="h-11 md:h-9" asChild>
          <Link href={adminPaths.dashboard}>대시보드로 돌아가기</Link>
        </Button>
        <Button type="button" className="h-11 md:h-9" disabled={!draft} onClick={save}>
          저장
        </Button>
      </div>
    </section>
  );
}
