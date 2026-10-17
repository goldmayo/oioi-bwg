import { z } from "zod";

const version = z.number().int().positive().max(2_147_483_647);
export const consoleMfaSetupSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});
export const consoleMfaConfirmSchema = consoleMfaSetupSchema.extend({
  otp: z.string().regex(/^\d{6}$/),
  version,
});
export const consoleMfaSetupResponseSchema = z.object({
  qrDataUrl: z
    .string()
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/)
    .max(64_000),
  version,
});
export const consoleMfaConfirmResponseSchema = z.object({ version });
export type ConsoleMfaSetup = z.infer<typeof consoleMfaSetupSchema>;
export type ConsoleMfaConfirm = z.infer<typeof consoleMfaConfirmSchema>;
export type ConsoleMfaSetupResponse = z.infer<typeof consoleMfaSetupResponseSchema>;
