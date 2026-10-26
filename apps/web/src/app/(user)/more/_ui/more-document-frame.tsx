import type { ReactNode } from "react";
import Link from "next/link";

export function MoreDocumentFrame({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 pt-10 pb-20 md:px-10 md:pt-14 md:pb-28">
      <nav
        aria-label="현재 위치"
        className="text-muted-foreground mb-7 flex flex-wrap items-center gap-3 text-sm"
      >
        <Link
          href="/more"
          prefetch={false}
          className="hover:text-foreground focus-visible:outline-ring -mx-1 -my-3 inline-flex min-h-11 items-center rounded-sm px-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          더보기
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          href={href}
          prefetch={false}
          className="hover:text-foreground focus-visible:outline-ring -mx-1 -my-3 inline-flex min-h-11 items-center rounded-sm px-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {title}
        </Link>
      </nav>
      <div className="border-border mb-10 border-b pb-7 md:mb-12">
        <h1 className="text-foreground text-4xl leading-tight font-bold tracking-tight text-balance md:text-5xl">
          {title}
        </h1>
      </div>
      {children}
    </div>
  );
}
