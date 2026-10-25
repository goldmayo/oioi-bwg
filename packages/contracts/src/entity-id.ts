import { z } from "zod";

// Domain PKs only; authentication challenges retain their separate UUIDv4 contract.
export const entityIdSchema = z.uuid({ version: "v7" }).transform((id) => id.toLowerCase());

export type EntityId = z.infer<typeof entityIdSchema>;
