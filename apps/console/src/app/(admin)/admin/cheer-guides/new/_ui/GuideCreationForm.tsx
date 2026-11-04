"use client";

import { type ReactNode, useId } from "react";
import { useWatch } from "react-hook-form";
import { Loader2 } from "lucide-react";

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
import { Label } from "@/shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Textarea } from "@/shared/ui/textarea";
import { UnsavedChangesDialog } from "@/shared/ui/unsaved-changes-dialog";

import type { GuideCreationValues } from "../_lib/guide-creation-form";
import { useGuideCreationForm } from "../_model/use-guide-creation-form";

import { SongPicker } from "./SongPicker";

export function GuideCreationForm({
  songs,
  initialSongId,
  canSubmit,
  submissionNotice,
  onSubmit,
  onSaved,
  onCancel,
}: {
  songs: AdminSongSummary[];
  initialSongId?: string;
  canSubmit: boolean;
  submissionNotice?: ReactNode;
  onSubmit: (values: GuideCreationValues) => Promise<void>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { form, submit, isSubmitting } = useGuideCreationForm({
    initialSongId,
    canSubmit,
    onSubmit,
    onSaved: () => {
      leave.release();
      onSaved();
    },
  });
  const leave = useFormLeaveConfirmation(form.formState.isDirty, isSubmitting);
  const sourceId = useId();
  const modeId = useId();
  const sourceType = useWatch({ control: form.control, name: "sourceType" });
  return (
    <>
      <Form {...form}>
        <form onSubmit={submit} noValidate>
          {submissionNotice}
          <fieldset disabled={isSubmitting || !canSubmit} className="min-w-0 space-y-8">
            <section aria-labelledby="guide-basics" className="space-y-5">
              <div className="flex items-baseline justify-between gap-4">
                <h2 id="guide-basics" className="text-lg font-semibold">
                  적용 대상
                </h2>
                <span className="text-muted-foreground text-sm">
                  <span className="text-destructive">*</span> 필수 항목
                </span>
              </div>
              <FormField
                control={form.control}
                name="songId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      곡 <Required />
                    </FormLabel>
                    <FormControl>
                      <SongPicker
                        songs={songs}
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>곡에 등록된 가사를 사용합니다.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="min-w-0">
                <FormField
                  control={form.control}
                  name="mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        공연 모드 <Required />
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          orientation="horizontal"
                          aria-label="공연 모드"
                          value={field.value}
                          onValueChange={field.onChange}
                          className="flex min-h-12 flex-wrap items-center gap-x-6 gap-y-2"
                        >
                          {(
                            [
                              ["CONCERT", "콘서트"],
                              ["FESTIVAL", "페스티벌"],
                            ] as const
                          ).map(([value, label]) => (
                            <div key={value} className="flex items-center gap-2.5">
                              <RadioGroupItem id={`${modeId}-${value}`} value={value} />
                              <Label
                                htmlFor={`${modeId}-${value}`}
                                className="min-h-11 cursor-pointer font-normal"
                              >
                                {label}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>
            <section aria-labelledby="guide-source" className="space-y-5">
              <h2 id="guide-source" className="text-lg font-semibold">
                출처 정보
              </h2>
              <FormField
                control={form.control}
                name="sourceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      출처 <Required />
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        orientation="horizontal"
                        aria-label="출처"
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          void form.trigger("sourceUrl");
                        }}
                        className="flex min-h-12 flex-wrap items-center gap-x-6 gap-y-2"
                      >
                        {(
                          [
                            ["OFFICIAL", "공식"],
                            ["FANDOM", "팬덤"],
                          ] as const
                        ).map(([value, label]) => (
                          <div key={value} className="flex items-center gap-2.5">
                            <RadioGroupItem id={`${sourceId}-${value}`} value={value} />
                            <Label
                              htmlFor={`${sourceId}-${value}`}
                              className="min-h-11 cursor-pointer font-normal"
                            >
                              {label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sourceUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      응원법 원본 링크 {sourceType === "OFFICIAL" ? <Required /> : <Optional />}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="url"
                        aria-required={sourceType === "OFFICIAL"}
                        placeholder="https://"
                        className="h-11"
                      />
                    </FormControl>
                    {sourceType === "OFFICIAL" && (
                      <FormDescription>
                        공식 응원법의 출처를 확인할 수 있는 링크를 입력합니다.
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      설명 <Optional />
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        className="min-h-28 resize-y"
                        placeholder="응원법의 특징이나 참고 사항"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>
          </fieldset>
          {form.formState.errors.root?.server?.message && (
            <p role="alert" className="text-destructive mt-6 text-sm">
              {form.formState.errors.root.server.message}
            </p>
          )}
          <footer className="mt-10 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={isSubmitting}
              onClick={() => leave.requestLeave(onCancel)}
            >
              취소
            </Button>
            <Button
              type="submit"
              className="h-11"
              disabled={isSubmitting || !canSubmit}
              variant="q"
            >
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}추가
            </Button>
          </footer>
        </form>
      </Form>
      <UnsavedChangesDialog open={leave.open} onStay={leave.stay} onLeave={leave.leave} />
    </>
  );
}

function Required() {
  return (
    <span className="text-destructive" aria-label="필수">
      *
    </span>
  );
}
function Optional() {
  return <span className="text-muted-foreground font-normal">(선택)</span>;
}
