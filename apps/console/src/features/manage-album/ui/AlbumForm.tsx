"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { useFormLeaveConfirmation } from "@/shared/model/use-form-leave-confirmation";
import { Button } from "@/shared/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { UnsavedChangesDialog } from "@/shared/ui/unsaved-changes-dialog";

import { type AlbumFormOptions, useAlbumForm } from "../model/use-album-form";

export function AlbumForm({
  onCancel,
  submissionNotice,
  canSubmit = true,
  onSaved,
  ...options
}: AlbumFormOptions & {
  onCancel: () => void;
  submissionNotice?: ReactNode;
}) {
  const {
    form,
    handleSubmit,
    uploadImage,
    fileInputRef,
    isSubmitting,
    isUploading,
    isBusy,
    isEdit,
  } = useAlbumForm({
    ...options,
    canSubmit,
    onSaved: () => {
      leave.release();
      onSaved();
    },
  });
  const leave = useFormLeaveConfirmation(form.formState.isDirty, isBusy);
  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isEdit ? "앨범 정보 수정" : "앨범 추가"}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {isEdit
            ? "앨범의 기본 정보와 이미지를 수정합니다."
            : "새 앨범의 정보와 이미지를 등록합니다."}
        </p>
      </header>
      {submissionNotice}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          <fieldset disabled={isBusy || !canSubmit} className="min-w-0 space-y-8">
            <section aria-labelledby="album-form-basics" className="space-y-5">
              <h2 id="album-form-basics" className="text-lg font-semibold">
                앨범 정보
              </h2>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>앨범 이름</FormLabel>
                    <FormControl>
                      <Input className="h-11" placeholder="예: 1st EP [MANITO]" {...field} />
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
                      <Input className="h-11" placeholder="예: ep1-manito" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>대표 색상</FormLabel>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          aria-label="대표 색상 선택"
                          value={field.value}
                          onChange={field.onChange}
                          className="h-11 w-11 shrink-0 cursor-pointer rounded border-0"
                        />
                        <FormControl>
                          <Input {...field} className="h-11 flex-1" />
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
                        <Input type="date" className="h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>
            <section aria-labelledby="album-form-image" className="space-y-5">
              <h2 id="album-form-image" className="text-lg font-semibold">
                앨범 이미지
              </h2>
              <FormField
                control={form.control}
                name="imgUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>이미지 URL</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input className="h-11 flex-1" placeholder="https://" {...field} />
                      </FormControl>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/avif,image/jpeg,image/png,image/webp"
                        onChange={uploadImage}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        disabled={isUploading || !canSubmit}
                        aria-label="앨범 이미지 업로드"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {isUploading && <Loader2 className="size-4 animate-spin" />}파일 선택
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>
            <section aria-labelledby="album-form-display" className="space-y-5">
              <h2 id="album-form-display" className="text-lg font-semibold">
                표시 설정
              </h2>

              <FormField
                control={form.control}
                name="isVisible"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4">
                    <div>
                      <FormLabel className="cursor-pointer">사용자 노출</FormLabel>
                      <p className="text-muted-foreground text-sm leading-6">
                        미표시 시 사용자 화면에서 숨겨집니다.
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </section>
          </fieldset>
          {form.formState.errors.root?.server?.message && (
            <p role="alert" className="text-destructive text-sm">
              {form.formState.errors.root.server.message}
            </p>
          )}
          <footer className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={isBusy}
              onClick={() => leave.requestLeave(onCancel)}
            >
              취소
            </Button>
            <Button
              type="submit"
              variant={isEdit ? "default" : "q"}
              className="h-11"
              disabled={isBusy || !canSubmit}
            >
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "저장" : "추가"}
            </Button>
          </footer>
        </form>
      </Form>
      <UnsavedChangesDialog open={leave.open} onStay={leave.stay} onLeave={leave.leave} />
    </>
  );
}
