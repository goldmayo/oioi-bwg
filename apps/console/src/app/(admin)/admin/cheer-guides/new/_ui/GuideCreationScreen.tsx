"use client";
import { AdminReauthenticationNotice } from "@/features/auth";

import { Button } from "@/shared/ui/button";

import { useGuideCreationScreen } from "../_model/use-guide-creation-screen";

import { GuideCreationForm } from "./GuideCreationForm";

export function GuideCreationScreen({ initialSongId }: { initialSongId?: string }) {
  const screen = useGuideCreationScreen(initialSongId);
  if (!screen.songs.data)
    return (
      <div role="status" className="space-y-4">
        <p>
          {screen.songs.isError ? "곡 목록을 불러오지 못했습니다." : "곡 목록을 불러오는 중입니다."}
        </p>
        {screen.songs.isError && (
          <Button variant="outline" onClick={() => void screen.songs.refetch()}>
            다시 시도
          </Button>
        )}
      </div>
    );
  return (
    <GuideCreationForm
      songs={screen.songs.data.items}
      initialSongId={initialSongId}
      canSubmit={screen.canSubmit}
      onSubmit={screen.submit}
      onSaved={screen.saved}
      onCancel={screen.cancel}
      submissionNotice={<AdminReauthenticationNotice recovery={screen.recovery} />}
    />
  );
}
