import { z } from "zod";

export const requestSignupOtpSchema = z.object({
  email: z.string().trim().email(),
});

export const verifySignupOtpSchema = z.object({
  challengeId: z.string().uuid(),
  otp: z.string().regex(/^\d{6}$/),
});

export const signupOtpResponseSchema = z.object({
  challengeId: z.string().uuid(),
});

export const verifySignupOtpResponseSchema = z.object({
  challengeId: z.string().uuid(),
  verified: z.literal(true),
});
