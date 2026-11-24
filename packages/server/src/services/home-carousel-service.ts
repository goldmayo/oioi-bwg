import "server-only";

import {
  adminHomeCarouselSchema,
  publicHomeCarouselSchema,
  type AdminHomeCarousel,
  type SaveHomeCarouselDraft,
} from "@oioi-bwg/contracts/home-carousel";

import { requireUser, type RequestContext } from "../auth/request-context";
import { getDatabase } from "../db";
import { createEntityId } from "../db/entity-id";
import { AppError } from "../errors/app-error";
import {
  findHomeCarousel,
  findPublishedHomeCarousel,
  saveHomeCarouselDraft,
} from "../repositories/home-carousel-repository";
import { getPublicAssetBaseUrl } from "../storage/upload-public-asset";

function requireAdmin(ctx: RequestContext) {
  requireUser(ctx);
  if (ctx.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
}

function mapAdmin(row: Awaited<ReturnType<typeof findHomeCarousel>>): AdminHomeCarousel {
  const result = adminHomeCarouselSchema.safeParse({
    id: row?.id ?? null,
    lockVersion: row ? row.lockVersion : 0,
    draftSlides: row ? row.draftSlides : [],
    publishedSlides: row ? row.publishedSlides : [],
    updatedAt: row ? new Date(row.updatedAt).toISOString() : null,
    publishedAt: row?.publishedAt ? new Date(row.publishedAt).toISOString() : null,
  });
  if (!result.success)
    throw new Error("Stored home carousel contract violation", { cause: result.error });
  return result.data;
}

export async function getAdminHomeCarousel(ctx: RequestContext) {
  requireAdmin(ctx);
  return mapAdmin(await findHomeCarousel(getDatabase()));
}

export async function getPublicHomeCarousel() {
  const row = await findPublishedHomeCarousel(getDatabase());
  const result = publicHomeCarouselSchema.safeParse(row ?? { items: [] });
  if (!result.success)
    throw new Error("Stored public home carousel contract violation", { cause: result.error });
  return result.data;
}

/** 입력 형태는 HTTP boundary에서 검증하며 ID 귀속과 asset 정책은 service가 검사한다. */
export async function saveAdminHomeCarouselDraft(
  ctx: RequestContext,
  input: SaveHomeCarouselDraft,
) {
  requireAdmin(ctx);
  const db = getDatabase();
  const current = mapAdmin(await findHomeCarousel(db));
  if (current.lockVersion !== input.expectedLockVersion)
    throw new AppError("HOME_CAROUSEL_CONFLICT");
  const knownIds = new Set(current.draftSlides.map(({ id }) => id));
  if (input.items.some(({ id }) => id !== undefined && !knownIds.has(id)))
    throw new AppError("HOME_CAROUSEL_ITEM_INVALID");
  if (input.items.length) {
    const prefix = `${getPublicAssetBaseUrl()}/images/home-carousel/`;
    const objectName = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(?:avif|jpg|png|webp)$/;
    if (
      input.items.some(
        ({ image }) =>
          !image.url.startsWith(prefix) || !objectName.test(image.url.slice(prefix.length)),
      )
    )
      throw new AppError("HOME_CAROUSEL_IMAGE_INVALID");
  }
  const slides = input.items.map((item) => ({ ...item, id: item.id ?? createEntityId() }));
  const saved = await saveHomeCarouselDraft(db, input.expectedLockVersion, slides);
  if (!saved) throw new AppError("HOME_CAROUSEL_CONFLICT");
  return mapAdmin(saved);
}
