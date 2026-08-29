import { z } from "zod";

/** 곡 생성 폼의 입력 검증 schema다. */
export const songFormSchema = z.object({
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
  lrcText: z.string().min(1, "LRC 파일을 업로드해주세요."),
});

export const songEditSchema = songFormSchema.omit({ lrcText: true }).extend({
  lrcText: z.string().optional(),
});

export type SongEditInput = z.input<typeof songEditSchema>;
export type SongEditValues = z.infer<typeof songEditSchema>;
