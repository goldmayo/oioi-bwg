import { z } from "zod";

/** 모든 Route Handler 실패가 반환하는 공개 오류 payload다. */
export const apiErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
