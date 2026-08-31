import { z } from "zod";

export const APP_ACTIONS = [
  "read",
  "create",
  "update",
  "delete",
  "resolve",
  "reject",
  "approve",
  "review",
  "carryOver",
  "process",
  "connect",
  "disconnect",
  "manage",
  "suspend",
  "unsuspend",
  "lock",
  "unlock",
  "register",
  "analyze",
  "override",
] as const;

export const APP_SUBJECTS = [
  "all",
  "Artist",
  "Song",
  "CheerGuide",
  "Revision",
  "Contribution",
  "DiscussionThread",
  "DiscussionComment",
  "Report",
  "Sanction",
  "Account",
  "Profile",
  "OAuthIdentity",
  "WaveformSource",
  "PerformanceSchedule",
  "AuditLog",
] as const;

export type SerializedAbilityRule = {
  action: string | string[];
  subject: string | string[];
  inverted?: boolean;
  conditions?: Record<string, unknown>;
  fields?: string[];
};

export const serializedAbilityRuleSchema = z.object({
  action: z.union([z.string(), z.array(z.string())]),
  subject: z.union([z.string(), z.array(z.string())]),
  inverted: z.boolean().optional(),
  conditions: z.record(z.string(), z.unknown()).optional(),
  fields: z.array(z.string()).optional(),
});

export const serializedAbilityResponseSchema = z.object({
  rules: z.array(serializedAbilityRuleSchema),
});

export type SerializedAbilityResponse = z.infer<typeof serializedAbilityResponseSchema>;
