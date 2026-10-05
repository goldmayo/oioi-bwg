import { z } from "zod";

/** 앨범 관리 폼의 입력 검증 schema다. */
export const albumFormSchema = z.object({
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

export type AlbumFormInput = z.input<typeof albumFormSchema>;
export type AlbumFormValues = z.infer<typeof albumFormSchema>;
