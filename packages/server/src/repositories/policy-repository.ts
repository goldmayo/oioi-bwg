import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { DbExecutor } from "../db";
import { servicePolicy as p } from "../db/schema";

export function findLatestPublishedPolicies(db: DbExecutor, slug?: string) {
  return db
    .selectDistinctOn([p.slug], {
      id: p.id,
      slug: p.slug,
      version: p.version,
      title: p.title,
      description: p.description,
      effectiveOn: p.effectiveOn,
      content: p.content,
      changeNotice: p.changeNotice,
    })
    .from(p)
    .where(and(eq(p.isPublished, true), slug === undefined ? undefined : eq(p.slug, slug)))
    .orderBy(p.slug, desc(p.version));
}
