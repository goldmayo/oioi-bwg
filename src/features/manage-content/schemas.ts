import { z } from "zod";

/**
 * 앨범 폼 검증 스키마
 */
export const AlbumFormSchema = z.object({
  name: z.string().min(1, "앨범 이름을 입력해주세요."),
  slug: z
    .string()
    .min(1, "slug를 입력해주세요.")
    .regex(/^[a-z0-9-]+$/, "slug는 영문 소문자, 숫자, 하이픈만 허용됩니다."),
  imgUrl: z.string().min(1, "이미지 URL을 입력해주세요.").url("올바른 URL 형식이 아닙니다."),
  color: z
    .string()
    .min(1, "색상을 입력해주세요.")
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "올바른 HEX 색상 코드를 입력해주세요."),
  releaseDate: z.string().optional(),
  isVisible: z.boolean().default(true),
});

/** 폼 입력 타입 (default 필드가 optional) */
export type AlbumFormInput = z.input<typeof AlbumFormSchema>;
/** 검증 완료 후 출력 타입 (default 필드가 확정) */
export type AlbumFormValues = z.infer<typeof AlbumFormSchema>;

/**
 * 곡 폼 검증 스키마
 */
export const SongFormSchema = z.object({
  albumId: z.number({ error: "앨범을 선택해주세요." }).min(1, "앨범을 선택해주세요."),
  title: z.string().min(1, "곡 제목을 입력해주세요."),
  slug: z
    .string()
    .min(1, "slug를 입력해주세요.")
    .regex(/^[a-z0-9-]+$/, "slug는 영문 소문자, 숫자, 하이픈만 허용됩니다."),
  youtubeId: z.string().min(1, "YouTube ID를 입력해주세요."),
  hasOfficialCheer: z.boolean().default(false),
  isTitle: z.boolean().default(false),
  isVisible: z.boolean().default(true),
  order: z.number().default(0),
  /** LRC 파일에서 파싱된 가사 텍스트 (폼 검증 시점에서는 raw string) */
  lrcText: z.string().min(1, "LRC 파일을 업로드해주세요."),
});

/** 폼 입력 타입 (default 필드가 optional) */
export type SongFormInput = z.input<typeof SongFormSchema>;
/** 검증 완료 후 출력 타입 */
export type SongFormValues = z.infer<typeof SongFormSchema>;

/**
 * 곡 편집 시 스키마 (LRC는 optional)
 */
export const SongEditSchema = SongFormSchema.omit({ lrcText: true }).extend({
  lrcText: z.string().optional(),
});

/** 곡 편집 입력 타입 */
export type SongEditInput = z.input<typeof SongEditSchema>;
/** 곡 편집 출력 타입 */
export type SongEditValues = z.infer<typeof SongEditSchema>;
