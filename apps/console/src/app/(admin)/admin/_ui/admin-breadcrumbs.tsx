import { ArrowLeft, ChevronRight } from "lucide-react";

import type { AdminBreadcrumb } from "../_config/admin-navigation";

export function AdminBreadcrumbs({
  items,
  backLink,
}: {
  items: AdminBreadcrumb[];
  backLink?: Required<AdminBreadcrumb>;
}) {
  return (
    <nav aria-label="현재 위치" className="flex min-w-0 flex-1 items-center gap-2">
      {backLink && (
        <a
          href={backLink.href}
          aria-label={backLink.label + "로 돌아가기"}
          className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring flex size-8 shrink-0 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
        </a>
      )}
      <ol className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm md:text-[13px]">
        {items.map((item, index) => (
          <li
            key={item.href ?? "current"}
            className={
              item.href
                ? "hidden shrink-0 items-center gap-1.5 sm:flex"
                : "flex min-w-0 items-center gap-1.5"
            }
          >
            {index > 0 && (
              <ChevronRight aria-hidden="true" className="hidden size-3 shrink-0 sm:block" />
            )}
            {item.href ? (
              <a
                href={item.href}
                className="hover:text-foreground underline-offset-4 hover:underline"
              >
                {item.label}
              </a>
            ) : (
              <span aria-current="page" className="text-foreground truncate font-medium">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
