"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { adminPaths } from "@/shared/config/admin-routes";
import { Button } from "@/shared/ui/button";

/** Slot이 RSC에서 전달된 lazy element를 복제하지 않도록 Link를 같은 client 경계에서 조합한다. */
export function DashboardNotificationsLink() {
  return (
    <Button asChild variant="outline" className="mt-5">
      <Link href={adminPaths.notificationList}>
        알림 내역 보기
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </Button>
  );
}
