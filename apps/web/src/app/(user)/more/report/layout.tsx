import type { ReactNode } from "react";

import { constructMetadata } from "@/shared/lib/metadata";

export const metadata = constructMetadata({
  title: "오류 제보",
  path: "/more/report",
  description: "어이어이바위게 서비스의 오류와 불편한 점을 알려주세요.",
  noIndex: true,
});

export default function ReportLayout({ children }: { children: ReactNode }) {
  return children;
}
