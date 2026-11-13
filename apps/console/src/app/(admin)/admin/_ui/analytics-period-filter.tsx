"use client";

import { type UseFormReturn, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type AnalyticsRange, analyticsRangeSchema } from "@oioi-bwg/contracts/analytics";
import { z } from "zod";

import { Input } from "@/shared/ui/input";
import { FilterSelect, ListFilterSheet } from "@/shared/ui/list-filter-sheet";

import { analyticsDateAgo, analyticsPreset } from "../_lib/analytics";

const periodSchema = analyticsRangeSchema
  .safeExtend({ preset: z.string() })
  .refine(({ to }) => to <= analyticsDateAgo(1), {
    message: "종료일은 어제까지 선택할 수 있습니다.",
  });

function PeriodFields({ form }: { form: UseFormReturn<AnalyticsRange & { preset: string }> }) {
  const [preset, from, to] = useWatch({ control: form.control, name: ["preset", "from", "to"] });
  return (
    <>
      <FilterSelect
        label="조회 기간"
        {...form.register("preset", {
          onChange: (event) => {
            if (event.target.value === "custom") return;
            const range = analyticsPreset(Number(event.target.value));
            form.setValue("from", range.from, { shouldDirty: true, shouldValidate: true });
            form.setValue("to", range.to, { shouldDirty: true, shouldValidate: true });
          },
        })}
      >
        <option value="7">최근 7일</option>
        <option value="28">최근 28일</option>
        <option value="90">최근 90일</option>
        <option value="custom">직접 선택</option>
      </FilterSelect>
      {preset === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="min-w-0 space-y-1 text-sm">
            <span>시작일</span>
            <Input
              type="date"
              className="h-11"
              {...form.register("from")}
              max={to || analyticsDateAgo(1)}
            />
          </label>
          <label className="min-w-0 space-y-1 text-sm">
            <span>종료일</span>
            <Input
              type="date"
              className="h-11"
              {...form.register("to")}
              min={from}
              max={analyticsDateAgo(1)}
            />
          </label>
          <p className="text-muted-foreground col-span-2 text-xs">
            최대 366일, 종료일은 어제까지 선택할 수 있습니다.
          </p>
          {Object.values(form.formState.errors).length > 0 && (
            <p role="alert" className="text-destructive col-span-2 text-sm">
              시작일과 종료일을 확인해 주세요.
            </p>
          )}
        </div>
      )}
    </>
  );
}

export function AnalyticsPeriodFilter({
  range,
  onApply,
}: {
  range: AnalyticsRange;
  onApply: (range: AnalyticsRange) => Promise<unknown>;
}) {
  const preset = [7, 28, 90].find((days) => {
    const candidate = analyticsPreset(days);
    return candidate.from === range.from && candidate.to === range.to;
  });
  return (
    <ListFilterSheet
      id="analytics-period-filters"
      urlBacked
      title="이용 분석 필터"
      activeCount={preset === 28 ? 0 : 1}
      values={{ ...range, preset: String(preset ?? "custom") }}
      defaults={{ ...analyticsPreset(28), preset: "28" }}
      resolver={zodResolver(periodSchema, undefined, { raw: true })}
      onApply={({ from, to }) => onApply({ from, to })}
    >
      {(form) => <PeriodFields form={form} />}
    </ListFilterSheet>
  );
}
