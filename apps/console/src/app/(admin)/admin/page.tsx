import { redirect } from "next/navigation";

/**
 * /admin → /admin/albums 로 자동 리다이렉트
 */
export default function AdminPage() {
  redirect("/admin/albums");
}
