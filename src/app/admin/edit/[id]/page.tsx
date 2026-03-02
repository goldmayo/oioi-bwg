import { notFound } from "next/navigation";

import { AdminEditorClient } from "@/components/admin/AdminEditorClient";
import { prisma } from "@/libs/prisma";

export default async function AdminEditPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const songId = parseInt(resolvedParams.id, 10);

  if (isNaN(songId)) {
    notFound();
  }

  const song = await prisma.song.findUnique({
    where: { id: songId },
  });

  if (!song) {
    notFound();
  }

  return <AdminEditorClient song={song} />;
}
