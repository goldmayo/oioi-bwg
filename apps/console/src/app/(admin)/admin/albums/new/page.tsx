import { AlbumScreenServer } from "../_ui/AlbumScreenServer";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default function AlbumCreatePage() {
  return <AlbumScreenServer />;
}
