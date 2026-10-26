import "server-only";
import {
  policySlugSchema,
  publicPolicySchema,
  publicPolicySummarySchema,
} from "@oioi-bwg/contracts/policy";
import { z } from "zod";
import { getDatabase } from "../db";
import { findLatestPublishedPolicies } from "../repositories/policy-repository";

export async function listPublicPolicies() {
  const result = z
    .array(publicPolicySummarySchema)
    .safeParse(await findLatestPublishedPolicies(getDatabase()));
  if (!result.success) throw new Error("Stored policy contract violation", { cause: result.error });
  return result.data.sort(
    (a, b) => policySlugSchema.options.indexOf(a.slug) - policySlugSchema.options.indexOf(b.slug),
  );
}

export async function getPublicPolicy(slug: string) {
  const parsedSlug = policySlugSchema.safeParse(slug);
  if (!parsedSlug.success) return null;
  const [row] = await findLatestPublishedPolicies(getDatabase(), parsedSlug.data);
  if (!row) return null;
  const result = publicPolicySchema.safeParse(row);
  if (!result.success) throw new Error("Stored policy contract violation", { cause: result.error });
  return result.data;
}
