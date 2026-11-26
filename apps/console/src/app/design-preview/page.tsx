import { Suspense } from "react";
import type { Metadata } from "next";

import { PreviewWorkspace } from "./_ui/preview-workspace";

import "./preview.css";

export const metadata: Metadata = {
  title: "어이어이바위게 · 디자인 미리보기",
  description: "곡 탐색과 응원법 편집, 어이어이바위게의 화면 디자인 가이드",
  robots: { index: false, follow: false },
};

export default function DesignPreviewPage() {
  return (
    <Suspense>
      <PreviewWorkspace />
    </Suspense>
  );
}
