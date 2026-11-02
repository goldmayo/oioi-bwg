"use client";
import { AdminReauthenticationNotice } from "@/features/auth";
import { type EditorReturnTarget, LazyLyricsEditor } from "@/features/manage-lyrics";

import { useGuideDraftEditor } from "../_model/use-guide-draft-editor";
export function GuideDraftEditor({
  id,
  accountId,
  returnTo,
}: {
  id: string;
  accountId: string;
  returnTo: EditorReturnTarget;
}) {
  const editor = useGuideDraftEditor(id);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <AdminReauthenticationNotice recovery={editor.recovery} />
      {!editor.canManage && !editor.recovery.requiresReauthentication && (
        <p role="alert">관리 권한이 없습니다. 작성 중인 내용은 이 화면에 유지됩니다.</p>
      )}
      <fieldset disabled={!editor.canManage} className="min-h-0 min-w-0 flex-1 border-0 p-0">
        <LazyLyricsEditor
          key={id}
          song={editor.song}
          accountId={accountId}
          saveSongData={editor.saveSongData}
          disabled={!editor.canManage}
          saveLabel="작업본 저장"
          referenceVideoReadOnly
          returnTo={{
            ...returnTo,
            description: "작업본을 저장해도 현재 공개본은 바뀌지 않습니다.",
          }}
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
