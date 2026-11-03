import { SongScreenServer } from "../_ui/SongScreenServer";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function SongInformationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <SongScreenServer id={id} mode={query.edit === "true" ? "edit" : "view"} />;
}
