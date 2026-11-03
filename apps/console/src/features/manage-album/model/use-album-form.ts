import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { AdminAlbumSummary } from "@/entities/album";

import { ApiError, getValidationFieldErrors } from "@/shared/api/http-errors";

import { type AlbumFormInput, albumFormSchema, type AlbumFormValues } from "./schemas";

export type UploadAlbumImage = (formData: FormData) => Promise<{
  success: boolean;
  url?: string;
  error?: string;
}>;
export interface AlbumFormOptions {
  album?: AdminAlbumSummary;
  canSubmit?: boolean;
  onUploadImage: UploadAlbumImage;
  onSubmit: (values: AlbumFormValues) => Promise<void>;
  onSaved: () => void;
}

export function useAlbumForm({
  album,
  canSubmit = true,
  onUploadImage,
  onSubmit,
  onSaved,
}: AlbumFormOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const busy = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const form = useForm<AlbumFormInput, unknown, AlbumFormValues>({
    resolver: zodResolver(albumFormSchema),
    defaultValues: {
      name: album?.name ?? "",
      slug: album?.slug ?? "",
      imgUrl: album?.imgUrl ?? "",
      color: album?.color ?? "#000000",
      releaseDate: album?.releaseDate?.split("T")[0] ?? "",
      isVisible: album?.isVisible ?? true,
    },
  });
  const uploadImage = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (!file || !canSubmit || busy.current) return;
      busy.current = true;
      setIsUploading(true);
      try {
        const data = new FormData();
        data.append("file", file);
        const result = await onUploadImage(data);
        if (result.success && result.url)
          form.setValue("imgUrl", result.url, { shouldValidate: true, shouldDirty: true });
        else form.setError("imgUrl", { message: result.error || "이미지 업로드에 실패했습니다." });
      } catch {
        form.setError("imgUrl", { message: "이미지를 업로드하지 못했습니다. 다시 시도해주세요." });
      } finally {
        busy.current = false;
        setIsUploading(false);
        input.value = "";
      }
    },
    [canSubmit, form, onUploadImage],
  );
  const handleSubmit = useCallback(
    async (values: AlbumFormValues) => {
      if (!canSubmit || busy.current) return;
      busy.current = true;
      setIsSubmitting(true);
      form.clearErrors("root.server");
      try {
        await onSubmit(values);
        onSaved();
      } catch (error) {
        const fieldErrors = getValidationFieldErrors(error);
        for (const field of albumFormSchema.keyof().options) {
          const message = fieldErrors?.[field]?.[0];
          if (message) form.setError(field, { message });
        }
        if (error instanceof ApiError && error.code === "ALBUM_SLUG_ALREADY_EXISTS")
          form.setError("slug", { message: error.message });
        else if (!fieldErrors || Object.keys(fieldErrors).length === 0)
          form.setError("root.server", {
            message: error instanceof Error ? error.message : "앨범 저장에 실패했습니다.",
          });
      } finally {
        busy.current = false;
        setIsSubmitting(false);
      }
    },
    [canSubmit, form, onSubmit, onSaved],
  );
  return {
    form,
    handleSubmit,
    uploadImage,
    fileInputRef,
    isSubmitting,
    isUploading,
    isBusy: isSubmitting || isUploading,
    isEdit: !!album,
  };
}
