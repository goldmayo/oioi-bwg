import { type BaseSyntheticEvent, useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { getValidationFieldErrors } from "@/shared/api/http-errors";

import {
  guideCreationFormSchema,
  type GuideCreationInput,
  type GuideCreationValues,
} from "../_lib/guide-creation-form";

export function useGuideCreationForm({
  initialSongId,
  onSubmit,
  onSaved,
  canSubmit,
}: {
  initialSongId?: string;
  onSubmit: (values: GuideCreationValues) => Promise<void>;
  onSaved: () => void;
  canSubmit: boolean;
}) {
  const pending = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<GuideCreationInput, unknown, GuideCreationValues>({
    resolver: zodResolver(guideCreationFormSchema),
    defaultValues: {
      songId: initialSongId ?? "",
      mode: "CONCERT",
      sourceType: "OFFICIAL",
      sourceUrl: "",
      description: "",
    },
  });
  const handleSubmit = useCallback(
    async (values: GuideCreationValues) => {
      if (pending.current || !canSubmit) return;
      pending.current = true;
      setIsSubmitting(true);
      form.clearErrors("root.server");
      try {
        await onSubmit(values);
      } catch (error) {
        const fieldErrors = getValidationFieldErrors(error);
        for (const name of ["songId", "mode", "sourceType", "sourceUrl", "description"] as const) {
          const message = fieldErrors?.[name]?.[0];
          if (message) form.setError(name, { message });
        }
        form.setError("root.server", {
          message: error instanceof Error ? error.message : "응원법을 추가하지 못했습니다.",
        });
        pending.current = false;
        setIsSubmitting(false);
        return;
      }
      // 성공 이후 이동 실패를 저장 실패로 취급해 중복 생성하지 않는다.
      onSaved();
    },
    [canSubmit, form, onSaved, onSubmit],
  );
  const submit = useCallback(
    (event?: BaseSyntheticEvent) => form.handleSubmit(handleSubmit)(event),
    [form, handleSubmit],
  );
  return { form, submit, isSubmitting };
}
