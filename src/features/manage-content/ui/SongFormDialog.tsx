"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";

import { Album } from "@/shared/api/db/drizzle/schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";

import { createSongAction, updateSongAction } from "../actions";
import { SongEditSchema, SongEditValues } from "../schemas";
import { LrcUploader } from "./LrcUploader";

/** 곡 편집 시 필요한 최소 데이터 */
interface SongEditData {
  id: number;
  title: string;
  slug: string;
  albumId: number;
  youtubeId: string;
  hasOfficialCheer: boolean;
  isTitle: boolean;
  order: number;
}

interface SongFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 앨범 목록 (select 옵션용) */
  albums: Album[];
  /** 편집 시 기존 곡 데이터 */
  song?: SongEditData;
  /** 저장 완료 콜백 */
  onSuccess?: () => void;
}

export function SongFormDialog({
  open,
  onOpenChange,
  albums,
  song,
  onSuccess,
}: SongFormDialogProps) {
  const isEdit = !!song;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lrcError, setLrcError] = useState<string | null>(null);

  // SongEditSchema(lrcText optional)로 통일하여 타입 호환성 문제 회피
  // 생성 시 lrcText 필수 검증은 onSubmit에서 직접 수행
  const form = useForm<SongEditValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zodResolver + zod v4 타입 호환성 이슈
    resolver: zodResolver(SongEditSchema) as any,
    defaultValues: {
      albumId: song?.albumId ?? 0,
      title: song?.title ?? "",
      slug: song?.slug ?? "",
      youtubeId: song?.youtubeId ?? "",
      hasOfficialCheer: song?.hasOfficialCheer ?? false,
      isTitle: song?.isTitle ?? false,
      order: song?.order ?? 0,
      lrcText: "",
    },
  });

  const onSubmit = useCallback(
    async (values: SongEditValues) => {
      // 생성 시 lrcText 필수 검증
      if (!isEdit && (!values.lrcText || values.lrcText.trim() === "")) {
        setLrcError("LRC 파일을 업로드해주세요.");
        return;
      }
      setLrcError(null);

      setIsSubmitting(true);
      const result = isEdit
        ? await updateSongAction(song!.id, values)
        : await createSongAction(values);
      setIsSubmitting(false);

      if (result.success) {
        onOpenChange(false);
        form.reset();
        onSuccess?.();
      } else {
        alert(result.error);
      }
    },
    [isEdit, song, onOpenChange, form, onSuccess],
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 앨범 선택 */}
            <FormField
              control={form.control}
              name="albumId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>앨범</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(Number(v))}
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

            {/* LRC 업로드 */}
            <FormField
              control={form.control}
              name="lrcText"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>
                    LRC 가사 파일{" "}
                    {isEdit && <span className="text-muted-foreground">(선택)</span>}
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
