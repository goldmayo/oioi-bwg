import { z } from "zod";

import { entityIdSchema } from "./entity-id";

const httpsUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .pipe(z.url({ protocol: /^https$/ }))
  .refine(
    (value) =>
      /^https:\/\/[^/?#@]+(?:[/?#]|$)/i.test(value) && !/[\u0000-\u0020\u007f\\]/.test(value),
    "사용자 정보 없는 HTTPS URL을 입력해주세요.",
  );

const internalLinkSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (value) =>
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !/[\u0000-\u0020\u007f\\]/.test(value) &&
      !/%(?:2f|5c)/i.test(value.split(/[?#]/)[0]!),
    "서비스 내부 경로를 입력해주세요.",
  );

export const homeCarouselImageSchema = z
  .object({
    url: httpsUrlSchema.refine((value) => !/[?#]/.test(value)),
    width: z.number().int().min(1).max(16384),
    height: z.number().int().min(1).max(16384),
  })
  .strict();

/** 공개 projection에는 관리용 이름과 공개 포함 여부를 넣지 않는다. */
export const homeCarouselSlideSchema = z
  .object({
    id: entityIdSchema,
    image: homeCarouselImageSchema,
    alt: z.string().trim().min(1).max(500),
    href: z.union([httpsUrlSchema, internalLinkSchema]).nullable(),
  })
  .strict();

export const homeCarouselDraftSlideSchema = homeCarouselSlideSchema.extend({
  name: z.string().trim().min(1).max(100),
  isEnabled: z.boolean(),
});

const publishedSlidesSchema = z
  .array(homeCarouselSlideSchema)
  .max(10)
  .refine(
    (items) => new Set(items.map(({ id }) => id)).size === items.length,
    "중복된 항목입니다.",
  );
const draftSlidesSchema = z
  .array(homeCarouselDraftSlideSchema)
  .max(10)
  .refine(
    (items) => new Set(items.map(({ id }) => id)).size === items.length,
    "중복된 항목입니다.",
  );

/** 새 항목의 ID는 저장 시 서버가 발급한다. 버전 0은 아직 구성 행이 없는 상태다. */
export const saveHomeCarouselDraftSchema = z
  .object({
    expectedLockVersion: z.number().int().nonnegative(),
    items: z
      .array(homeCarouselDraftSlideSchema.extend({ id: entityIdSchema.optional() }))
      .max(10)
      .refine((items) => {
        const ids = items.flatMap(({ id }) => (id ? [id] : []));
        return new Set(ids).size === ids.length;
      }, "중복된 항목입니다."),
  })
  .strict();

export const homeCarouselVersionInputSchema = z
  .object({ expectedLockVersion: z.number().int().positive() })
  .strict();

export const adminHomeCarouselSchema = z
  .object({
    id: entityIdSchema.nullable(),
    lockVersion: z.number().int().nonnegative(),
    draftSlides: draftSlidesSchema,
    publishedSlides: publishedSlidesSchema,
    updatedAt: z.iso.datetime({ offset: true }).nullable(),
    publishedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict();
export const publicHomeCarouselSchema = z.object({ items: publishedSlidesSchema }).strict();

export type HomeCarouselImage = z.infer<typeof homeCarouselImageSchema>;
export type HomeCarouselSlide = z.infer<typeof homeCarouselSlideSchema>;
export type HomeCarouselDraftSlide = z.infer<typeof homeCarouselDraftSlideSchema>;
export type SaveHomeCarouselDraft = z.infer<typeof saveHomeCarouselDraftSchema>;
export type HomeCarouselVersionInput = z.infer<typeof homeCarouselVersionInputSchema>;
export type AdminHomeCarousel = z.infer<typeof adminHomeCarouselSchema>;
export type PublicHomeCarousel = z.infer<typeof publicHomeCarouselSchema>;
