import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Read-only capture from the current Web container on 2026-10-21, release 18462a4004780a0b43bcadf77792ef8fa22b082390498774331ed2a704a31c1a.
// This public action identifier is not a credential.
const retiredUploadId = "404b2752601764e93253b9698b2f44db9c54fc3ac8";

export async function assertWebAdminRetired(browser, origin, sql, artifacts) {
  const manifest = JSON.parse(
    fs.readFileSync("apps/web/.next/server/server-reference-manifest.json", "utf8"),
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
      const page = await context.newPage();
      await page.goto(`${origin}/login`);
      await page.getByLabel("Email").waitFor();
      if (email.startsWith("user@")) {
        await page.screenshot({ path: path.join(artifacts, "web-login.png"), fullPage: true });
      }
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill("P04-fixture-pass1!");
      await page.getByRole("button", { name: "로그인", exact: true }).click();
      await page.waitForURL(`${origin}/`);
      const session = await (await context.request.get(`${origin}/api/auth/session`)).json();
      assert.ok(session.user?.id, "ordinary Web credentials must still authenticate");
      if (email.startsWith("user@")) {
        await page.screenshot({ path: path.join(artifacts, "web-login-home.png"), fullPage: true });
      }
    }
    for (const route of [
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
      assert.equal(response.status(), 404, "retired upload Action at " + route);
    }
    if (email?.startsWith("admin@")) admin = { context, cookies: await context.cookies() };
    else await context.close();
  }
  assert.equal(await snapshot(), before, "retired Web calls must not mutate managed data");
  assert.ok((await fetch(origin + "/")).ok);
  console.log(
    "Web admin retired: guest/USER/ADMIN denied routes and old upload Action; ordinary login works",
  );
  return admin;
}
