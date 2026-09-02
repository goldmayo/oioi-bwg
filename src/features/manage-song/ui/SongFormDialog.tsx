"use client";

import { useCallback, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import type { AdminAlbumSummary } from "@/entities/album";
import type { AdminSongSummary } from "@/entities/song";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";

import { type SongEditInput, songEditSchema, type SongEditValues } from "../model/schemas";

import { LrcUploader } from "./LrcUploader";

interface SongFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 앨범 목록 (select 옵션용) */
  albums: AdminAlbumSummary[];
  /** 편집 시 기존 곡 데이터 */
  song?: AdminSongSummary;
  onSubmit: (values: SongEditValues) => Promise<void>;
}

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

  for (const fieldName of songFormFieldNames) {
    const message = fieldErrors?.[fieldName]?.[0];
    if (message) form.setError(fieldName, { message });
  }

  if (error instanceof ApiError && error.code === "SONG_LYRICS_INVALID") {
    setLrcError(error.message);
  } else if (!fieldErrors || Object.keys(fieldErrors).length === 0) {
    form.setError("root.server", {
      message: error instanceof Error ? error.message : "곡 저장에 실패했습니다.",
    });
  }
}

export function SongFormDialog({
  open,
  onOpenChange,
  albums,
  song,
  onSubmit,
}: SongFormDialogProps) {
  const isEdit = !!song;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lrcError, setLrcError] = useState<string | null>(null);

  // songEditSchema(lrcText optional)로 통일하여 타입 호환성 문제를 피한다.
  // 생성 시 lrcText 필수 검증은 onSubmit에서 직접 수행
  const form = useForm<SongEditInput, unknown, SongEditValues>({
    resolver: zodResolver(songEditSchema),
    defaultValues: {
      albumId: song?.albumId ?? 0,
      title: song?.title ?? "",
      slug: song?.slug ?? "",
      youtubeId: song?.youtubeId ?? "",
      hasOfficialCheer: song?.hasOfficialCheer ?? false,
      isTitle: song?.isTitle ?? false,
      isVisible: song?.isVisible ?? true,
      order: song?.order ?? 0,
      lrcText: "",
    },
  });

  const handleSubmit = useCallback(
    async (values: SongEditValues) => {
      // 생성 시 lrcText 필수 검증
      if (!isEdit && (!values.lrcText || values.lrcText.trim() === "")) {
        setLrcError("LRC 파일을 업로드해주세요.");
        return;
      }
      setLrcError(null);
      form.clearErrors("root.server");

      setIsSubmitting(true);
      try {
        await onSubmit(values);
        onOpenChange(false);
        form.reset();
      } catch (error) {
        applySongFormError(error, form, setLrcError);
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, isEdit, onOpenChange, onSubmit],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "곡 수정" : "곡 추가"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "곡 정보를 수정합니다." : "새 곡을 추가합니다. LRC 파일이 필요합니다."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* 앨범 선택 */}
            <FormField
              control={form.control}
              name="albumId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>앨범</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v: string) => field.onChange(Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="앨범을 선택하세요" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {albums.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 곡 제목 & Slug */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>곡 제목</FormLabel>
                    <FormControl>
                      <Input placeholder="예: 고민중독" {...field} />
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
                      <Input placeholder="예: worry-addiction" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* YouTube ID */}
            <FormField
              control={form.control}
              name="youtubeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>YouTube ID</FormLabel>
                  <FormControl>
                    <Input placeholder="예: dBWKUpJu2PA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 순서 */}
            <FormField
              control={form.control}
              name="order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>정렬 순서</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 토글 옵션 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="isTitle"
                render={({ field }) => (
                  <FormItem className="bg-accent/30 flex items-center justify-between rounded-lg p-3">
                    <FormLabel className="cursor-pointer">타이틀곡</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hasOfficialCheer"
                render={({ field }) => (
                  <FormItem className="bg-accent/30 flex items-center justify-between rounded-lg p-3">
                    <FormLabel className="cursor-pointer">공식 응원법</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
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

            {/* LRC 업로드 */}
            <FormField
              control={form.control}
              name="lrcText"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>
                    LRC 가사 파일 {isEdit && <span className="text-muted-foreground">(선택)</span>}
                  </FormLabel>
                  <LrcUploader
                    value={field.value}
                    onLrcParsed={(text) => {
                      field.onChange(text);
                      setLrcError(null);
                    }}
                    error={lrcError || fieldState.error?.message}
                  />
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
