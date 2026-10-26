import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { DbExecutor } from "../db";
import { servicePublication as p } from "../db/schema";

export function findPublicPublications(db: DbExecutor, kind: "notice" | "update") {
  return db
    .select({
      id: p.id,
      kind: p.kind,
      title: p.title,
      publishedOn: p.publishedOn,
      category: p.category,
      releaseVersion: p.releaseVersion,
      content: p.content,
    })
    .from(p)
    .where(and(eq(p.kind, kind), eq(p.isPublished, true)))
    .orderBy(desc(p.publishedOn), desc(p.id));
}
