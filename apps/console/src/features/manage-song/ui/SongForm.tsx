"use client";

import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import type { AdminAlbumSummary } from "@/entities/album";
import type { AdminSongSummary } from "@/entities/song";

import { useFormLeaveConfirmation } from "@/shared/model/use-form-leave-confirmation";
import { Button } from "@/shared/ui/button";
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
import { UnsavedChangesDialog } from "@/shared/ui/unsaved-changes-dialog";

import type { SongEditValues } from "../model/schemas";
import { useSongForm } from "../model/use-song-form";

import { LrcUploader } from "./LrcUploader";

interface SongFormProps {
  canSubmit?: boolean;
  submissionNotice?: ReactNode;
  guideSummary?: ReactNode;
  onCancel: () => void;
  onSaved: () => void;
  /** 앨범 목록 (select 옵션용) */
  albums: AdminAlbumSummary[];
  /** 편집 시 기존 곡 데이터 */
  song?: AdminSongSummary;
  onSubmit: (values: SongEditValues, guideWrite?: AdminSongSummary["guideWrite"]) => Promise<void>;
}

export function SongForm({
  canSubmit = true,
  submissionNotice,
  guideSummary,
  onCancel,
  onSaved,
  albums,
  song,
  onSubmit,
}: SongFormProps) {
  const { form, handleSubmit, isEdit, hasImmutableSlug, isSubmitting, lrcError, clearLrcError } =
    useSongForm({
      song,
      canSubmit,
      onSubmit,
      onSaved: () => {
        leave.release();
        onSaved();
      },
    });

  const leave = useFormLeaveConfirmation(form.formState.isDirty);
  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {isEdit ? "곡 정보 수정" : "곡 추가"}
              </h1>
              <p className="text-muted-foreground mt-2 text-sm">
                {isEdit
                  ? "곡의 기본 정보와 가사 파일을 수정합니다."
                  : "새 곡의 정보와 LRC 가사 파일을 등록합니다."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => leave.requestLeave(onCancel)}
              >
                취소
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting || !canSubmit}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {isEdit ? "저장" : "추가"}
              </Button>
            </div>
          </header>
          {submissionNotice}
          <fieldset disabled={isSubmitting} className="grid min-w-0 gap-8 lg:grid-cols-3">
            <section className="min-w-0 space-y-5 lg:col-span-2" aria-labelledby="song-form-basics">
              <h2 id="song-form-basics" className="border-b pb-3 font-medium">
                기본 정보
              </h2>
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
              <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
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
              </div>
              <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
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
            </section>
            <aside className="space-y-8">
              <section className="space-y-5" aria-labelledby="song-form-display">
                <h2 id="song-form-display" className="border-b pb-3 font-medium">
                  표시 설정
                </h2>

                <FormField
                  control={form.control}
                  name="isTitle"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4">
                      <FormLabel className="cursor-pointer">타이틀곡</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* 화면 표시 설정 */}
                <FormField
                  control={form.control}
                  name="isVisible"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4">
                      <div>
                        <FormLabel className="cursor-pointer">화면 표시</FormLabel>
                        <p className="text-muted-foreground text-xs">
                          앨범 설정과 응원법 공개 상태도 사용자 노출에 영향을 줍니다.
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </section>
              {guideSummary}
            </aside>
          </fieldset>
        </form>
      </Form>
      <UnsavedChangesDialog open={leave.open} onStay={leave.stay} onLeave={leave.leave} />
    </>
  );
}
