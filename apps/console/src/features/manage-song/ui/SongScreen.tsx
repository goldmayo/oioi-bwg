"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { Button } from "@/shared/ui/button";

import { useSongScreen } from "../model/use-song-screen";

import { SongForm } from "./SongForm";
import { SongGuideSummary, SongInformation } from "./SongInformation";

export function SongScreen({
  id,
  mode,
  canManage,
  submissionNotice,
  onMutationError,
}: {
  id?: string;
  mode: "view" | "edit" | "create";
  canManage: boolean;
  submissionNotice?: ReactNode;
  onMutationError?: (error: unknown) => void;
}) {
  const { information, albums, submit, saved } = useSongScreen(id, onMutationError);
  const song = information.data;
  if (id && !song)
    return (
      <div role="status" className="space-y-4 py-8">
        <p>
          {information.isError ? "곡 정보를 불러오지 못했습니다." : "곡 정보를 불러오는 중입니다."}
        </p>
        {information.isError && (
          <Button variant="outline" onClick={() => void information.refetch()}>
            다시 시도
          </Button>
        )}
      </div>
    );
  return (
    <>
      <nav aria-label="현재 위치" className="text-muted-foreground mb-6 text-sm">
        <Link href="/admin/songs" className="hover:text-foreground">
          곡 관리
        </Link>
        <span aria-hidden> / </span>
        {mode === "create" ? "곡 추가" : "곡 정보"}
      </nav>
      {mode === "view" && song ? (
        <>
          {submissionNotice}
          <SongInformation song={song} canManage={canManage} />
        </>
      ) : (
        <SongForm
          key={id ?? "new"}
          albums={albums}
          song={song}
          canSubmit={canManage}
          guideSummary={song ? <SongGuideSummary song={song} canManage={canManage} /> : undefined}
          submissionNotice={submissionNotice}
          onSubmit={submit}
          onSaved={saved}
          onCancel={() => window.location.replace(id ? `/admin/songs/${id}` : "/admin/songs")}
        />
      )}
    </>
  );
}
