import { ChevronRight } from "lucide-react";

import type { AdminBreadcrumb } from "../_config/admin-navigation";

export function AdminBreadcrumbs({ items }: { items: AdminBreadcrumb[] }) {
  return (
    <nav
      aria-label="현재 위치"
      className="order-last w-full min-w-0 md:order-none md:w-auto md:flex-1"
    >
      <ol className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
        {items.map((item, index) => (
          <li key={item.href ?? "current"} className="flex min-w-0 items-center gap-2">
            {index > 0 && <ChevronRight aria-hidden="true" className="size-4 shrink-0" />}
            {item.href ? (
              <a
                href={item.href}
                className="hover:text-foreground underline-offset-4 hover:underline"
              >
                {item.label}
              </a>
            ) : (
              <span aria-current="page" className="text-foreground font-medium break-words">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
