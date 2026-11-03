import { AlbumScreenServer } from "../../_ui/AlbumScreenServer";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function AlbumEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AlbumScreenServer id={id} />;
}
