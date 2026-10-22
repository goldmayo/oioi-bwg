import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const consoleRequire = createRequire(new URL("../../apps/console/package.json", import.meta.url));
const { encode } = await import(consoleRequire.resolve("next-auth/jwt"));

// Read-only capture from the current Web container on 2026-10-21, release 18462a4004780a0b43bcadf77792ef8fa22b082390498774331ed2a704a31c1a.
// This public action identifier is not a credential.
const retiredUploadId = "404b2752601764e93253b9698b2f44db9c54fc3ac8";

export async function assertWebAdminRetired(browser, origin, sql, artifacts) {
  const manifest = JSON.parse(
    fs.readFileSync(
      "apps/web/.next/standalone/apps/web/.next/server/server-reference-manifest.json",
      "utf8",
    ),
  );
  for (const entry of Object.values(manifest.node ?? {})) {
    assert.notEqual(entry.exportedName, "uploadAlbumImageAction");
    assert.ok(!entry.filename?.includes("/(admin)/"));
  }
  const snapshot = async () =>
    JSON.stringify(
      await sql`select
    (select coalesce(jsonb_agg(a order by id), '[]') from "Album" a) as albums,
    (select coalesce(jsonb_agg(s order by id), '[]') from "Song" s) as songs`,
    );
  const before = await snapshot();
  let admin;
  for (const email of [null, "user@p04.example.test", "admin@p04.example.test"]) {
    const context = await browser.newContext();
    if (email) {
      const [account] =
        await sql`select account_id from password_credential where email = ${email}`;
      const name = "authjs.session-token";
      // A valid pre-retirement Web JWT must no longer give Web an identity.
      const value = await encode({
        token: { sub: String(account.account_id) },
        secret: "p04-web-private-browser-fixture-secret",
        salt: name,
      });
      await context.addCookies([{ name, value, url: origin }]);
    }
    for (const route of [
      "/login",
      "/api/auth/session",
      "/api/auth/ability",
      "/api/auth/csrf",
      "/api/auth/signin",
      "/api/auth/signout",
      "/api/auth/callback/credentials",
      "/admin",
      "/admin/albums",
      "/admin/songs",
      "/admin/edit/fixture",
      "/admin-login",
      "/api/admin/albums",
      "/api/admin/albums/1",
      "/api/admin/songs",
      "/api/admin/songs/1",
      "/api/admin/songs/1/lyrics",
    ]) {
      assert.equal(
        (await context.request.get(origin + route, { maxRedirects: 0 })).status(),
        404,
        route,
      );
      if (route.startsWith("/api/")) {
        for (const method of ["POST", "PATCH", "DELETE"]) {
          const response = await context.request.fetch(origin + route, {
            method,
            headers: { Origin: origin },
            data: { title: "must-not-write", lyrics: [] },
            maxRedirects: 0,
          });
          assert.equal(response.status(), 404, method + " " + route);
        }
      }
    }
    for (const route of ["/", "/login", "/admin/albums"]) {
      const response = await context.request.post(origin + route, {
        headers: { "Next-Action": retiredUploadId, Origin: origin },
        multipart: { 0: '["$K1"]' },
        maxRedirects: 0,
      });
      // Next 16.4.1 reports unavailable, well-formed Action IDs as 409.
      // Require its explicit rejection marker/body, not an arbitrary conflict response.
      assert.equal(response.status(), 409, "retired upload Action at " + route);
      assert.equal(response.headers()["x-nextjs-action-not-found"], "1");
      assert.match(response.headers()["content-type"], /^text\/plain\b/);
      assert.equal(await response.text(), "Server Action unavailable.");
    }
    if (email?.startsWith("admin@")) admin = { context, cookies: await context.cookies() };
    else await context.close();
  }
  const page = await browser.newPage();
  await page.goto(origin + "/");
  await page.screenshot({ path: path.join(artifacts, "web-public-home.png"), fullPage: true });
  await page.close();
  assert.equal(await snapshot(), before, "retired Web calls must not mutate managed data");
  assert.ok((await fetch(origin + "/")).ok);
  console.log(
    "Web admin retired: guest/legacy USER/ADMIN denied auth/admin and old upload Action; public reads work",
  );
  return admin;
}
