import "server-only";

import type { HomeCarouselDraftSlide } from "@oioi-bwg/contracts/home-carousel";
import { and, eq, sql } from "drizzle-orm";

import type { DbExecutor } from "../db";
import { homeCarousel } from "../db/schema";

export async function findHomeCarousel(db: DbExecutor) {
  const [row] = await db.select().from(homeCarousel).where(eq(homeCarousel.placement, "home"));
  return row;
}

export async function findPublishedHomeCarousel(db: DbExecutor) {
  const [row] = await db
    .select({ items: homeCarousel.publishedSlides })
    .from(homeCarousel)
    .where(eq(homeCarousel.placement, "home"));
  return row;
}

/** 전체 구성의 CAS이며 공개본은 이 mutation에서 변경하지 않는다. */
export async function saveHomeCarouselDraft(
  db: DbExecutor,
  expectedLockVersion: number,
  draftSlides: HomeCarouselDraftSlide[],
) {
  const [row] =
    expectedLockVersion === 0
      ? await db
          .insert(homeCarousel)
          .values({ placement: "home", draftSlides })
          .onConflictDoNothing({ target: homeCarousel.placement })
          .returning()
      : await db
          .update(homeCarousel)
          .set({
            draftSlides,
            lockVersion: sql`${homeCarousel.lockVersion} + 1`,
            updatedAt: sql`now()`,
          })
          .where(
            and(
              eq(homeCarousel.placement, "home"),
              eq(homeCarousel.lockVersion, expectedLockVersion),
            ),
          )
          .returning();
  return row;
}
