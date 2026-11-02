import { useCallback, useRef, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { AdminSongSummary } from "@/entities/song";

import { ApiError, getValidationFieldErrors } from "@/shared/api/http-errors";

import { getSongFormDefaults } from "../lib/song-form";

import { type SongEditInput, songEditSchema, type SongEditValues } from "./schemas";

const songFormFieldNames = [
  "albumId",
  "title",
  "slug",
  "youtubeId",
  "hasOfficialCheer",
  "isTitle",
  "isVisible",
  "order",
  "lrcText",
] as const;

function applySongFormError(
  error: unknown,
  form: UseFormReturn<SongEditInput, unknown, SongEditValues>,
  setLrcError: (message: string) => void,
) {
  const fieldErrors = getValidationFieldErrors(error);
  const isSlugConflict =
    error instanceof ApiError &&
    (error.code === "SONG_SLUG_ALREADY_EXISTS" || error.code === "SONG_SLUG_IMMUTABLE");

  for (const fieldName of songFormFieldNames) {
    const message = fieldErrors?.[fieldName]?.[0];
    if (message) form.setError(fieldName, { message });
  }

  if (isSlugConflict) form.setError("slug", { message: error.message });

  if (error instanceof ApiError && error.code === "SONG_LYRICS_INVALID") {
    setLrcError(error.message);
  } else if (!isSlugConflict && (!fieldErrors || Object.keys(fieldErrors).length === 0)) {
    form.setError("root.server", {
      message: error instanceof Error ? error.message : "곡 저장에 실패했습니다.",
    });
  }
}

export function useSongForm({
  song,
  canSubmit = true,
  onSubmit,
  onSaved,
}: {
  song?: AdminSongSummary;
  canSubmit?: boolean;
  onSubmit: (values: SongEditValues, guideWrite?: AdminSongSummary["guideWrite"]) => Promise<void>;
  onSaved: () => void;
}) {
  const [initialSong] = useState(song);
  const pending = useRef(false);
  const isEdit = !!initialSong;
  const hasImmutableSlug = initialSong !== undefined && initialSong.slug !== null;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lrcError, setLrcError] = useState<string | null>(null);

  // songEditSchema(lrcText optional)로 통일하여 타입 호환성 문제를 피한다.
  // 생성 시 lrcText 필수 검증은 onSubmit에서 직접 수행
  const form = useForm<SongEditInput, unknown, SongEditValues>({
    resolver: zodResolver(songEditSchema),
    defaultValues: getSongFormDefaults(initialSong),
  });

  const handleSubmit = useCallback(
    async (values: SongEditValues) => {
      if (!canSubmit || pending.current) return;
      if (!isEdit && values.slug === "") {
        form.setError("slug", { message: "slug를 입력해주세요." });
        return;
      }
      // 생성 시 lrcText 필수 검증
      if (!isEdit && (!values.lrcText || values.lrcText.trim() === "")) {
        setLrcError("LRC 파일을 업로드해주세요.");
        return;
      }
      setLrcError(null);
      form.clearErrors("root.server");

      pending.current = true;
      setIsSubmitting(true);
      try {
        await onSubmit(values, initialSong?.guideWrite);
        onSaved();
      } catch (error) {
        applySongFormError(error, form, setLrcError);
        pending.current = false;
        setIsSubmitting(false);
      }
    },
    [canSubmit, form, initialSong, isEdit, onSaved, onSubmit],
  );

  return {
    form,
    handleSubmit,
    isEdit,
    hasImmutableSlug,
    isSubmitting,
    lrcError,
    clearLrcError: () => setLrcError(null),
  };
}
