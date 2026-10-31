import { z } from "zod";
const deviceCode = z.string().regex(/^[a-f0-9]{64}$/);
const userCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
export const operatorDeviceGrantSchema = z.strictObject({
  deviceCode,
  userCode,
  expiresAt: z.iso.datetime({ offset: true }),
  intervalSeconds: z.literal(5),
});
export const operatorApprovalInputSchema = z.strictObject({ userCode });
export const operatorExchangeInputSchema = z.strictObject({ deviceCode });
export const operatorExchangeResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("pending") }),
  z.strictObject({
    status: z.literal("authorized"),
    accessToken: z.string().regex(/^oioi_[a-f0-9]{64}$/),
    expiresAt: z.iso.datetime({ offset: true }),
  }),
]);
export type OperatorDeviceGrant = z.infer<typeof operatorDeviceGrantSchema>;
export type OperatorExchangeResult = z.infer<typeof operatorExchangeResultSchema>;
