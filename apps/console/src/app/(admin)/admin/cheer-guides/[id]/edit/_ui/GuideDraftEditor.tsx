"use client";
import { AdminReauthenticationNotice } from "@/features/auth";
import { LazyLyricsEditor } from "@/features/manage-lyrics";

import { useGuideDraftEditor } from "../_model/use-guide-draft-editor";
export function GuideDraftEditor({ id, accountId }: { id: string; accountId: string }) {
  const editor = useGuideDraftEditor(id);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-sm">
        <p className="text-muted-foreground">작업본을 저장해도 현재 공개본은 바뀌지 않습니다.</p>
        <a className="underline underline-offset-4" href="/admin/cheer-guides">
          응원법 목록
        </a>
      </div>
      <AdminReauthenticationNotice recovery={editor.recovery} />
      <fieldset disabled={!editor.canManage} className="min-h-0 min-w-0 flex-1 border-0 p-0">
        <LazyLyricsEditor
          key={id}
          song={editor.song}
          accountId={accountId}
          saveSongData={editor.saveSongData}
          disabled={!editor.canManage}
          saveLabel="작업본 저장"
          referenceVideoReadOnly
          protectNavigation
          waveformImport={
            editor.guide.referenceYoutubeId === editor.guide.song.currentYoutubeId
              ? {
                  videoId: editor.guide.referenceYoutubeId,
                  onError: editor.recovery.handleMutationError,
                }
              : undefined
          }
        />
      </fieldset>
    </div>
  );
}
