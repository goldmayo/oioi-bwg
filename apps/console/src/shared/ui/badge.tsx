"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/shared/lib/utils";

const paletteBadgeClasses =
  "border-[color-mix(in_oklab,var(--badge-color)_30%,var(--border))] bg-[color-mix(in_oklab,var(--badge-color)_10%,var(--muted))] text-foreground before:size-1.5 before:shrink-0 before:rounded-full before:border before:border-foreground/15 before:bg-[var(--badge-color)] before:content-['']";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-foreground [a&]:hover:bg-accent",
        secondary: "border-border bg-muted text-foreground [a&]:hover:bg-accent",
        q: `${paletteBadgeClasses} [--badge-color:var(--qwer-q)]`,
        w: `${paletteBadgeClasses} [--badge-color:var(--qwer-w)]`,
        e: `${paletteBadgeClasses} [--badge-color:var(--qwer-e)]`,
        r: `${paletteBadgeClasses} [--badge-color:var(--qwer-r)]`,
        bwg: `${paletteBadgeClasses} [--badge-color:var(--qwer-bwg)]`,
        rockation: `${paletteBadgeClasses} [--badge-color:var(--qwer-rockation)]`,
        destructive: `${paletteBadgeClasses} [--badge-color:var(--destructive)] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40`,
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
