import { SongScreenServer } from "../_ui/SongScreenServer";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default function SongCreatePage() {
  return <SongScreenServer mode="create" />;
}
