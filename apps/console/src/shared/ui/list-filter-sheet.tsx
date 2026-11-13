"use client";

import { type ReactNode, useEffect, useId } from "react";
import {
  type Control,
  type FieldPath,
  type FieldValues,
  type Resolver,
  useController,
  useForm,
  type UseFormReturn,
} from "react-hook-form";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";

import { useFilterOverlay } from "../model/use-filter-overlay";

import { Button } from "./button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./sheet";

type FilterFormProps<T extends FieldValues> = {
  values: T;
  defaults: T;
  resolver?: Resolver<T>;
  onApply: (values: T) => void | Promise<unknown>;
  children: (form: UseFormReturn<T>) => ReactNode;
};

function FilterForm<T extends FieldValues>({
  values,
  defaults,
  resolver,
  onApply,
  children,
  open,
}: FilterFormProps<T> & { open: boolean }) {
  const form = useForm<T>({ values, resolver, mode: "onChange" });
  const { reset } = form;
  const { isDirty, isSubmitting, isValid } = form.formState;

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  return (
    <form onSubmit={form.handleSubmit(onApply)} className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 gap-4 overflow-y-auto overscroll-contain px-5 py-4">
        {children(form)}
      </div>
      <div className="border-border flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="ghost"
          className="h-11 px-2"
          disabled={isSubmitting}
          onClick={() => form.reset(defaults, { keepDefaultValues: true })}
        >
          초기화
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="h-11" disabled={isSubmitting}>
              취소
            </Button>
          </SheetClose>
          <Button type="submit" className="h-11" disabled={!isDirty || !isValid || isSubmitting}>
            적용
          </Button>
        </div>
      </div>
    </form>
  );
}

export function ListFilterSheet<T extends FieldValues>({
  id,
  title,
  activeCount = 0,
  urlBacked = false,
  ...formProps
}: FilterFormProps<T> & { id: string; title: string; activeCount?: number; urlBacked?: boolean }) {
  const overlay = useFilterOverlay(id);
  return (
    <Sheet open={overlay.open} onOpenChange={(open) => (open ? overlay.show() : overlay.close())}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant={activeCount ? "secondary" : "outline"}
          className="h-11 shrink-0 gap-1.5 md:h-9"
          aria-label={activeCount ? "필터, 적용된 조건 " + activeCount + "개" : "필터"}
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          필터
          {activeCount > 0 && (
            <span aria-hidden="true" className="bg-accent rounded px-1 tabular-nums">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        className="bg-popover mx-auto max-h-[min(100dvh,40rem)] max-w-lg gap-0 overflow-hidden rounded-t-xl transition-none data-[state=closed]:duration-150 data-[state=open]:duration-200 motion-reduce:animate-none"
      >
        <SheetHeader className="border-border flex shrink-0 flex-row items-center justify-between gap-3 border-b py-2 pr-2 pl-5 text-left">
          <SheetTitle className="text-base">{title}</SheetTitle>
          <SheetClose asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="필터 닫기"
              className="size-11"
            >
              <X aria-hidden="true" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <FilterForm
          {...formProps}
          open={overlay.open}
          onApply={async (values) => {
            if (urlBacked) {
              await formProps.onApply(values);
              overlay.close({ replace: true });
              return;
            }
            overlay.close({
              afterClose: () => {
                void formProps.onApply(values);
              },
            });
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

export function FilterSelect<T extends FieldValues>({
  label,
  children,
  control,
  name,
  onChange,
}: {
  label: string;
  children: ReactNode;
  control: Control<T>;
  name: FieldPath<T>;
  onChange?: (value: string) => void;
}) {
  const { field } = useController({ control, name });
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-muted-foreground text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <select
          {...field}
          id={id}
          onChange={(event) => {
            field.onChange(event);
            onChange?.(event.target.value);
          }}
          className="border-input bg-background text-foreground focus-visible:ring-ring h-11 w-full min-w-0 appearance-none truncate rounded-md border pr-9 pl-3 text-base outline-none focus-visible:ring-2"
        >
          {children}
        </select>
        <ChevronDown
          className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
