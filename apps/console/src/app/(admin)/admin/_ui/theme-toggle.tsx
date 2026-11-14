"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/shared/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 shrink-0 md:size-8"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Moon aria-hidden="true" className="size-5 md:size-4 dark:hidden" />
      <Sun aria-hidden="true" className="hidden size-5 md:size-4 dark:block" />
      <span className="sr-only dark:hidden">다크 모드로 전환</span>
      <span className="sr-only hidden dark:block">라이트 모드로 전환</span>
    </Button>
  );
}
