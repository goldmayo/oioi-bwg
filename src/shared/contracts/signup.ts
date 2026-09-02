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

export const completeSignupSchema = z.object({
  challengeId: z.string().uuid(),
  password: z
    .string()
    .min(10)
    .max(32)
    .regex(/[A-Za-z]/)
    .regex(/\d/)
    .regex(/[^A-Za-z\d]/),
  nickname: z.string().trim().min(1).max(32),
});

export const completeSignupResponseSchema = z.object({
  accountId: z.string(),
});

export type RequestSignupOtp = z.infer<typeof requestSignupOtpSchema>;
export type VerifySignupOtp = z.infer<typeof verifySignupOtpSchema>;
export type SignupOtpResponse = z.infer<typeof signupOtpResponseSchema>;
export type VerifySignupOtpResponse = z.infer<typeof verifySignupOtpResponseSchema>;
export type CompleteSignup = z.infer<typeof completeSignupSchema>;
export type CompleteSignupResponse = z.infer<typeof completeSignupResponseSchema>;
