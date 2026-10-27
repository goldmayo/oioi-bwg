import "server-only";
import { publicNoticeSchema, publicUpdateSchema } from "@oioi-bwg/contracts/publication";
import { z } from "zod";
import { getDatabase } from "../db";
import { findPublicPublications } from "../repositories/publication-repository";

export async function listPublicNotices() {
  const result = z
    .array(publicNoticeSchema)
    .safeParse(await findPublicPublications(getDatabase(), "notice"));
  if (!result.success) throw new Error("Stored notice contract violation", { cause: result.error });
  return result.data;
}
export async function listPublicUpdates() {
  const result = z
    .array(publicUpdateSchema)
    .safeParse(await findPublicPublications(getDatabase(), "update"));
  if (!result.success) throw new Error("Stored update contract violation", { cause: result.error });
  return result.data;
}
