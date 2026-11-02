"use client";

import type { ComponentProps } from "react";
import { RadioGroup as RadioPrimitive } from "radix-ui";

import { cn } from "@/shared/lib/utils";

export function RadioGroup({ className, ...props }: ComponentProps<typeof RadioPrimitive.Root>) {
  return <RadioPrimitive.Root className={cn("grid gap-2", className)} {...props} />;
}

export function RadioGroupItem({
  className,
  ...props
}: ComponentProps<typeof RadioPrimitive.Item>) {
  return (
    <RadioPrimitive.Item
      className={cn(
        "border-muted-foreground text-primary focus-visible:ring-ring/50 flex size-4 shrink-0 items-center justify-center rounded-full border outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator className="flex items-center justify-center">
        <span className="size-2 rounded-full bg-current" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Item>
  );
}
