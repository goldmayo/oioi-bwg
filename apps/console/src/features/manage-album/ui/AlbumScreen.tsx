"use client";

import type { ReactNode } from "react";

import type { AdminAlbumSummary } from "@/entities/album";

import { adminPaths } from "@/shared/config/admin-routes";

import type { UploadAlbumImage } from "../model/use-album-form";
import { useAlbumScreen } from "../model/use-album-screen";

import { AlbumForm } from "./AlbumForm";

export function AlbumScreen({
  album,
  canManage,
  onUploadImage,
  submissionNotice,
  onMutationError,
}: {
  album?: AdminAlbumSummary;
  canManage: boolean;
  onUploadImage: UploadAlbumImage;
  submissionNotice?: ReactNode;
  onMutationError?: (error: unknown) => void;
}) {
  const screen = useAlbumScreen(album, onMutationError);
  return (
    <AlbumForm
      key={album?.id ?? "new"}
      album={album}
      canSubmit={canManage}
      onUploadImage={onUploadImage}
      onSubmit={screen.submit}
      onSaved={screen.saved}
      onCancel={() => window.location.replace(adminPaths.albumList)}
      submissionNotice={submissionNotice}
    />
  );
}
