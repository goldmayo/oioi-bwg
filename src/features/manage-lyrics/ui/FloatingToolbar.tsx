"use client";

import { Button } from "@/shared/ui/button";

import { useAdminEditorContext } from "./AdminEditorContext";

/**
 * 가사 텍스트 드래그 선택 시 나타나는 말풍선 툴바.
 *
 * 선택된 텍스트를 Echo(따라하기) 또는 Reset(일반 텍스트)으로 분리합니다.
 * toolbar 상태가 없거나 show가 false이면 렌더링하지 않습니다.
 *
 * 위치: toolbar.x / toolbar.y (뷰포트 기준 fixed 포지션)
 */
export function FloatingToolbar() {
  const { toolbar, handleSplitSegment } = useAdminEditorContext();

  if (!toolbar?.show) return null;

  return (
    <div
      className="border-border bg-popover fixed z-50 flex gap-1 rounded border p-1 shadow-xl"
      style={{
        left: toolbar.x,
        top: toolbar.y,
        transform: "translate(-50%, 0)",
      }}
    >
      {/* Echo: 선택 텍스트를 isCheer + isEcho 세그먼트로 분리 */}
      <Button
        size="sm"
        variant="ghost"
        className="text-qwer-w hover:bg-qwer-w/10 hover:text-qwer-w h-7 text-xs"
        onMouseDown={(e) => {
          e.preventDefault(); // 드래그 선택 해제 방지
          handleSplitSegment("echo");
        }}
      >
        Echo (따라하기)
      </Button>

      {/* Reset: 선택 텍스트를 isCheer=false, isEcho=false로 초기화 */}
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-foreground h-7 text-xs"
        onMouseDown={(e) => {
          e.preventDefault();
          handleSplitSegment("reset");
        }}
      >
        Reset
      </Button>
    </div>
  );
}
