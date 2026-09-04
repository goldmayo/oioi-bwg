"use client";

import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Loader2 } from "lucide-react";

import type { AdminAlbumSummary } from "@/entities/album";

import { ApiError, getValidationFieldErrors } from "@/shared/api/http-errors";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";

import { uploadAlbumImageAction } from "../api/upload-album-image-action";
import { type AlbumFormInput, albumFormSchema, type AlbumFormValues } from "../model/schemas";

interface AlbumFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 편집 시 기존 앨범 데이터 */
  album?: AdminAlbumSummary;
  onSubmit: (values: AlbumFormValues) => Promise<void>;
}

export function AlbumFormDialog({ open, onOpenChange, album, onSubmit }: AlbumFormDialogProps) {
  const isEdit = !!album;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<AlbumFormInput, unknown, AlbumFormValues>({
    resolver: zodResolver(albumFormSchema),
    defaultValues: {
      name: album?.name ?? "",
      slug: album?.slug ?? "",
      imgUrl: album?.imgUrl ?? "",
      color: album?.color ?? "#000000",
      releaseDate: album?.releaseDate ? album.releaseDate.split("T")[0] : "",
      isVisible: album?.isVisible ?? true,
    },
  });

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadAlbumImageAction(formData);
      setIsUploading(false);

      if (result.success && result.url) {
        form.setValue("imgUrl", result.url, { shouldValidate: true });
      } else {
        form.setError("imgUrl", {
          message: result.error || "이미지 업로드에 실패했습니다.",
        });
      }
      e.target.value = "";
    },
    [form],
  );

  const handleSubmit = useCallback(
    async (values: AlbumFormValues) => {
      form.clearErrors("root.server");
      setIsSubmitting(true);
      try {
        await onSubmit(values);
        onOpenChange(false);
        form.reset();
      } catch (error) {
        const fieldErrors = getValidationFieldErrors(error);
        const fieldNames = ["name", "slug", "imgUrl", "color", "releaseDate", "isVisible"] as const;

        for (const fieldName of fieldNames) {
          const message = fieldErrors?.[fieldName]?.[0];
          if (message) form.setError(fieldName, { message });
        }

        if (error instanceof ApiError && error.code === "ALBUM_SLUG_ALREADY_EXISTS") {
          form.setError("slug", { message: error.message });
        } else if (!fieldErrors || Object.keys(fieldErrors).length === 0) {
          form.setError("root.server", {
            message: error instanceof Error ? error.message : "앨범 저장에 실패했습니다.",
          });
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, onOpenChange, onSubmit],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "앨범 수정" : "앨범 추가"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "앨범 정보를 수정합니다." : "새 앨범을 추가합니다."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>앨범 이름</FormLabel>
                  <FormControl>
                    <Input placeholder="예: 1st EP [MANITO]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input placeholder="예: ep1-manito" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="imgUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>앨범 이미지</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input placeholder="이미지 URL" {...field} className="flex-1" />
                    </FormControl>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/avif,image/jpeg,image/png,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>대표 색상</FormLabel>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={field.value}
                        onChange={field.onChange}
                        className="h-9 w-9 shrink-0 cursor-pointer rounded border-0"
                      />
                      <FormControl>
                        <Input {...field} className="flex-1" />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="releaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>발매일</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 화면 표시 설정 */}
            <FormField
              control={form.control}
              name="isVisible"
              render={({ field }) => (
                <FormItem className="bg-accent/30 flex items-center justify-between rounded-lg p-3">
                  <div>
                    <FormLabel className="cursor-pointer">화면 표시</FormLabel>
                    <p className="text-muted-foreground text-xs">
                      미표시 시 사용자 화면에서 숨겨집니다.
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {form.formState.errors.root?.server?.message && (
              <p role="alert" className="text-destructive text-sm">
                {form.formState.errors.root.server.message}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "수정" : "추가"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
