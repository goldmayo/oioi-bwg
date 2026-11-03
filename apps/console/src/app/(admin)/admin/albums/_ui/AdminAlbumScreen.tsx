"use client";

import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import {
  AdminReauthenticationNotice,
  authAbilityQueries,
  createClientAbility,
  useAdminReauthentication,
} from "@/features/auth";
import { AlbumScreen } from "@/features/manage-album";

import type { AdminAlbumSummary } from "@/entities/album";

import { uploadAlbumImageAction } from "../_lib/upload-album-image-action";

export function AdminAlbumScreen({ album }: { album?: AdminAlbumSummary }) {
  const { data } = useSuspenseQuery(authAbilityQueries.current());
  const ability = useMemo(() => createClientAbility(data.rules), [data.rules]);
  const recovery = useAdminReauthentication();
  return (
    <AlbumScreen
      album={album}
      canManage={ability.can("manage", "all") && !recovery.requiresReauthentication}
      onUploadImage={uploadAlbumImageAction}
      onMutationError={recovery.handleMutationError}
      submissionNotice={<AdminReauthenticationNotice recovery={recovery} />}
    />
  );
}
