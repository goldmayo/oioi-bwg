"use client";

import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import type { AdminAlbumSummary } from "@/entities/album";
import type { AdminSongSummary } from "@/entities/song";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";

import type { SongEditValues } from "../model/schemas";
import { useSongForm } from "../model/use-song-form";

import { LrcUploader } from "./LrcUploader";

interface SongFormDialogProps {
  open: boolean;
  canSubmit?: boolean;
  submissionNotice?: ReactNode;
  onOpenChange: (open: boolean) => void;
  /** 앨범 목록 (select 옵션용) */
  albums: AdminAlbumSummary[];
  /** 편집 시 기존 곡 데이터 */
  song?: AdminSongSummary;
  onSubmit: (values: SongEditValues) => Promise<void>;
}

export function SongFormDialog(props: SongFormDialogProps) {
  return props.open ? <SongFormSession {...props} /> : null;
}

function SongFormSession({
  open,
  canSubmit = true,
  submissionNotice,
  onOpenChange,
  albums,
  song,
  onSubmit,
}: SongFormDialogProps) {
  const { form, handleSubmit, isEdit, hasImmutableSlug, isSubmitting, lrcError, clearLrcError } =
    useSongForm({
      song,
      canSubmit,
      onSubmit: (values) => onSubmit(values),
      onSaved: () => onOpenChange(false),
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "곡 수정" : "곡 추가"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "곡 정보를 수정합니다." : "새 곡을 추가합니다. LRC 파일이 필요합니다."}
          </DialogDescription>
        </DialogHeader>

        {submissionNotice}
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
                    onValueChange={(v: string) => field.onChange(v)}
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
                      <Input
                        placeholder="예: worry-addiction"
                        readOnly={hasImmutableSlug}
                        aria-readonly={hasImmutableSlug}
                        {...field}
                      />
                    </FormControl>
                    {isEdit && (
                      <FormDescription>
                        {hasImmutableSlug
                          ? "한 번 지정한 slug는 변경할 수 없습니다."
                          : "비워두거나 최초 slug를 지정할 수 있습니다."}
                      </FormDescription>
                    )}
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
                      clearLrcError();
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
              <Button type="submit" disabled={isSubmitting || !canSubmit}>
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
