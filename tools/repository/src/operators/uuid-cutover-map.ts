import { createHash } from "node:crypto";

import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { z } from "zod";

const legacyId = z
  .string()
  .regex(/^[1-9]\d{0,18}$/)
  .pipe(z.string().refine((id) => BigInt(id) <= 9_223_372_036_854_775_807n));
const sourceSchema = z.strictObject({
  albums: z.array(z.strictObject({ id: legacyId })),
  songs: z.array(z.strictObject({ id: legacyId, albumId: legacyId })),
  accounts: z
    .array(
      z.strictObject({
        id: legacyId,
        role: z.enum(["USER", "REVIEWER", "ADMIN"]),
        status: z.enum(["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "DELETED"]),
        mfaVersion: z.number().int().positive().max(2_147_483_647).nullable(),
      }),
    )
    .default([]),
});
const mapSchema = z.strictObject({
  formatVersion: z.literal(2),
  identityFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  albums: z.array(z.strictObject({ oldId: legacyId, id: entityIdSchema })),
  songs: z.array(z.strictObject({ oldId: legacyId, id: entityIdSchema, albumId: entityIdSchema })),
  accounts: z.array(
    sourceSchema.shape.accounts
      .unwrap()
      .element.omit({ id: true })
      .extend({ oldId: legacyId, id: entityIdSchema }),
  ),
  resetAdminOldIds: z.array(legacyId),
});

export const parseUuidCutoverMap = (input: unknown) => mapSchema.parse(input);

function requireValid(condition: boolean) {
  if (!condition) throw new Error("UUID_CUTOVER_MAP_REJECTED");
}

function readSource(input: unknown) {
  const source = sourceSchema.parse(input);
  source.albums.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  source.songs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  source.accounts.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const albums = new Set(source.albums.map((row) => row.id));
  requireValid(albums.size === source.albums.length);
  requireValid(new Set(source.songs.map((row) => row.id)).size === source.songs.length);
  requireValid(source.songs.every((row) => albums.has(row.albumId)));
  requireValid(new Set(source.accounts.map((row) => row.id)).size === source.accounts.length);
  return {
    source,
    fingerprint: createHash("sha256").update(JSON.stringify(source)).digest("hex"),
  };
}

/** Identity/FK coverage only. Payload preservation must be verified separately at cutover. */
export function validateUuidCutoverMap(input: unknown, savedMap: unknown) {
  const { source, fingerprint } = readSource(input);
  const mapping = mapSchema.parse(savedMap);
  requireValid(mapping.identityFingerprint === fingerprint);
  const albums = new Map(mapping.albums.map((row) => [row.oldId, row.id]));
  const songs = new Map(mapping.songs.map((row) => [row.oldId, row]));
  const accounts = new Map(mapping.accounts.map((row) => [row.oldId, row]));
  const ids = [...mapping.albums, ...mapping.songs, ...mapping.accounts].map((row) => row.id);
  requireValid(new Set(ids).size === ids.length);
  requireValid(mapping.albums.length === albums.size && albums.size === source.albums.length);
  requireValid(mapping.songs.length === songs.size && songs.size === source.songs.length);
  requireValid(source.albums.every((row) => albums.has(row.id)));
  requireValid(
    mapping.accounts.length === accounts.size && accounts.size === source.accounts.length,
  );
  requireValid(
    source.accounts.every((row) => {
      const saved = accounts.get(row.id);
      return (
        !!saved &&
        saved.role === row.role &&
        saved.status === row.status &&
        saved.mfaVersion === row.mfaVersion
      );
    }),
  );
  requireValid(new Set(mapping.resetAdminOldIds).size === mapping.resetAdminOldIds.length);
  requireValid(
    mapping.resetAdminOldIds.every(
      (id) => accounts.get(id)?.role === "ADMIN" && accounts.get(id)?.status === "ACTIVE",
    ),
  );
  requireValid(
    source.songs.every(
      (row) => songs.has(row.id) && songs.get(row.id)!.albumId === albums.get(row.albumId),
    ),
  );
  return mapping;
}

export function createUuidCutoverMap(
  input: unknown,
  nextId: () => string,
  resetAdminOldIds: string[] = [],
) {
  const { source, fingerprint } = readSource(input);
  const albums = source.albums.map((row) => ({ oldId: row.id, id: nextId() }));
  const albumIds = new Map(albums.map((row) => [row.oldId, row.id]));
  return validateUuidCutoverMap(source, {
    formatVersion: 2,
    identityFingerprint: fingerprint,
    albums,
    accounts: source.accounts.map(({ id, ...facts }) => ({ ...facts, oldId: id, id: nextId() })),
    resetAdminOldIds,
    songs: source.songs.map((row) => ({
      oldId: row.id,
      id: nextId(),
      albumId: albumIds.get(row.albumId)!,
    })),
  });
}
