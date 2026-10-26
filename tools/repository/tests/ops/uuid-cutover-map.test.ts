import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createUuidCutoverMap, validateUuidCutoverMap } from "../../src/operators/uuid-cutover-map";

const source = {
  albums: [{ id: "1" }, { id: "9" }],
  songs: [{ id: "9007199254740993", albumId: "1" }],
};
function allocator() {
  let count = 0;
  return () => `019a0170-0000-7000-8000-${String(++count).padStart(12, "0")}`;
}

describe("offline UUID cutover map", () => {
  it("runs the real CLI offline, protects its output, and never overwrites a saved map", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "uuid-map-"));
    const sourceFile = path.join(directory, "source.json");
    const mapFile = path.join(directory, "map.json");
    const script = fileURLToPath(
      new URL("../../../../scripts/plan-uuid-cutover.ts", import.meta.url),
    );
    const run = (mode: string) =>
      spawnSync(
        process.execPath,
        ["--conditions=react-server", "--import", "tsx", script, mode, sourceFile, mapFile],
        { encoding: "utf8", env: { ...process.env, DATABASE_URL: "invalid-offline-only" } },
      );
    try {
      writeFileSync(sourceFile, JSON.stringify(source));
      const created = run("create");
      expect(created.status, created.stderr).toBe(0);
      expect(JSON.parse(created.stdout)).toMatchObject({ success: true, albums: 2, songs: 1 });
      const saved = readFileSync(mapFile, "utf8");
      expect(statSync(mapFile).mode & 0o777).toBe(0o600);
      expect(run("verify").status).toBe(0);
      expect(run("create").status).toBe(1);
      expect(readFileSync(mapFile, "utf8")).toBe(saved);
      writeFileSync(sourceFile, JSON.stringify({ ...source, songs: [] }));
      expect(run("verify").status).toBe(1);
      writeFileSync(sourceFile, "invalid JSON");
      expect(JSON.parse(run("verify").stderr)).toEqual({
        success: false,
        code: "UUID_CUTOVER_PLAN_REJECTED",
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("preserves empty albums, int8 precision, and the original parent relationship", () => {
    const map = createUuidCutoverMap(source, allocator());
    expect(map.albums).toHaveLength(2);
    expect(map.songs[0]).toMatchObject({ oldId: "9007199254740993", albumId: map.albums[0]!.id });
    expect(validateUuidCutoverMap(source, JSON.parse(JSON.stringify(map)))).toEqual(map);
    expect(
      validateUuidCutoverMap({ ...source, albums: [...source.albums].reverse() }, map),
    ).toEqual(map);
  });

  it("rejects changed source, incomplete/duplicate maps, wrong parents, and ID collisions", () => {
    const map = createUuidCutoverMap(source, allocator());
    for (const broken of [
      { ...map, albums: map.albums.slice(1) },
      { ...map, songs: [] },
      { ...map, albums: [map.albums[0], map.albums[0]] },
      { ...map, songs: [{ ...map.songs[0], albumId: map.albums[1]!.id }] },
      { ...map, songs: [{ ...map.songs[0], id: map.albums[0]!.id }] },
      { ...map, songs: [{ ...map.songs[0], oldId: "42" }] },
    ])
      expect(() => validateUuidCutoverMap(source, broken)).toThrow();
    expect(() =>
      validateUuidCutoverMap({ ...source, songs: [{ ...source.songs[0], albumId: "9" }] }, map),
    ).toThrow();
    expect(() =>
      validateUuidCutoverMap({ ...source, albums: [...source.albums, { id: "10" }] }, map),
    ).toThrow();
    expect(() => createUuidCutoverMap(source, () => map.albums[0]!.id)).toThrow();
    expect(() =>
      createUuidCutoverMap(source, () => "019a0170-0000-4000-8000-000000000001"),
    ).toThrow();
  });

  it("binds account facts and authorizes only explicitly selected active administrators", () => {
    const input = {
      ...source,
      accounts: [
        { id: "5", role: "ADMIN", status: "ACTIVE", mfaVersion: 4 },
        { id: "6", role: "USER", status: "ACTIVE", mfaVersion: null },
      ],
    };
    const map = createUuidCutoverMap(input, allocator(), ["5"]);
    expect(map.formatVersion).toBe(2);
    expect(validateUuidCutoverMap(input, map)).toEqual(map);
    for (const broken of [
      { ...map, formatVersion: 1 },
      { ...map, accounts: map.accounts.slice(1) },
      { ...map, accounts: [map.accounts[0], map.accounts[0]] },
      { ...map, accounts: [{ ...map.accounts[0], mfaVersion: 3 }, map.accounts[1]] },
      { ...map, accounts: [{ ...map.accounts[0], id: map.albums[0]!.id }, map.accounts[1]] },
      { ...map, resetAdminOldIds: ["5", "5"] },
      { ...map, resetAdminOldIds: ["6"] },
      { ...map, resetAdminOldIds: ["99"] },
    ])
      expect(() => validateUuidCutoverMap(input, broken)).toThrow();
    expect(() =>
      validateUuidCutoverMap(
        { ...input, accounts: [{ ...input.accounts[0], status: "SUSPENDED" }, input.accounts[1]] },
        map,
      ),
    ).toThrow();
  });

  it.each([
    { ...source, albums: [{ id: 1 }] },
    { ...source, albums: [{ id: "01" }] },
    { ...source, albums: [{ id: "9223372036854775808" }] },
    { ...source, albums: [{ id: "1" }, { id: "1" }] },
    { ...source, songs: [source.songs[0], source.songs[0]] },
    { ...source, songs: [{ id: "1", albumId: "99" }] },
  ])("rejects ambiguous legacy IDs and orphan sources before allocation", (input) => {
    let calls = 0;
    expect(() =>
      createUuidCutoverMap(input, () => {
        calls++;
        return allocator()();
      }),
    ).toThrow();
    expect(calls).toBe(0);
  });
});
