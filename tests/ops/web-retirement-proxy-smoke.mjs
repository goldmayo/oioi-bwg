import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import net from "node:net";
import path from "node:path";

const fetch = (url, init = {}) =>
  globalThis.fetch(url, { ...init, signal: AbortSignal.timeout(2000) });

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "p06-web-guard-"));
const name = "p06-web-guard-" + process.pid;
let caddy;
const seen = [];
const upstream = http.createServer((request, response) => {
  seen.push(request.method + " " + request.url);
  response.writeHead(203);
  response.end("fixture");
});
upstream.listen(0, "127.0.0.1");
await once(upstream, "listening");
const portReservation = net.createServer();
await new Promise((resolve) => portReservation.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + portReservation.address().port;
await new Promise((resolve) => portReservation.close(resolve));
const docker = (args) => {
  const result = spawnSync("docker", args, { encoding: "utf8", timeout: 120_000 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
try {
  fs.copyFileSync("ops/oci/web-retirement.caddy", path.join(directory, "guard.caddy"));
  fs.writeFileSync(
    path.join(directory, "Caddyfile"),
    `{
    admin off
    auto_https off
  }
  ${origin} {
    route {
      import ${directory}/guard.caddy
      reverse_proxy 127.0.0.1:${upstream.address().port}
    }
  }`,
  );
  // Extract the versioned official binary to run in the same network namespace as the local app.
  // Docker Desktop host networking can point at a different VM than WSL localhost.
  docker([
    "create",
    "--name",
    name,
    "caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d",
  ]);
  const executable = path.join(directory, "caddy");
  docker(["cp", name + ":/usr/bin/caddy", executable]);
  fs.chmodSync(executable, 0o700);
  const log = fs.openSync(path.join(directory, "caddy.log"), "w");
  caddy = spawn(
    executable,
    ["run", "--config", path.join(directory, "Caddyfile"), "--adapter", "caddyfile"],
    {
      env: { PATH: process.env.PATH, XDG_DATA_HOME: directory, XDG_CONFIG_HOME: directory },
      stdio: ["ignore", log, log],
    },
  );
  fs.closeSync(log);
  let ready = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      ready = (await fetch(origin + "/healthz")).status === 203;
    } catch {
      /* start */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, fs.readFileSync(path.join(directory, "caddy.log"), "utf8"));
  seen.length = 0;
  for (const route of [
    "/admin",
    "/admin/albums",
    "/admin-login",
    "/api/admin/songs",
    "/api/%61dmin/songs",
    "/api/auth/signup/otp",
    "/api/auth/signup/otp/verify",
    "/api/auth/signup/complete",
    "/signup",
  ]) {
    for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
      assert.equal((await fetch(origin + route, { method })).status, 403, method + route);
    }
  }
  for (const route of ["/", "/login", "/more", "/api/auth/callback/credentials"]) {
    assert.equal(
      (
        await fetch(origin + route, {
          method: "POST",
          headers: { "Next-Action": "captured-old-action" },
          body: "[]",
        })
      ).status,
      403,
    );
  }
  for (const route of ["/", "/login", "/more"]) {
    const body = new FormData();
    body.set("$ACTION_ID_captured-old-action", "");
    assert.equal((await fetch(origin + route, { method: "POST", body })).status, 403);
  }
  assert.deepEqual(seen, [], "rejected requests never reach even an old upstream");
  for (const [method, route] of [
    ["GET", "/"],
    ["HEAD", "/"],
    ["GET", "/login"],
    ["GET", "/api/auth/csrf"],
    ["POST", "/api/auth/callback/credentials"],
    ["POST", "/api/auth/signout"],
  ])
    assert.equal((await fetch(origin + route, { method })).status, 203, method + route);
  console.log(
    "Caddy 2.10.2: closed admin/signup/Action requests never reach upstream; read and Auth.js POST allowed",
  );
} finally {
  if (caddy && caddy.exitCode === null && caddy.signalCode === null) {
    const exited = once(caddy, "exit");
    caddy.kill("SIGTERM");
    const timeout = setTimeout(() => caddy.kill("SIGKILL"), 5000);
    await exited;
    clearTimeout(timeout);
  }
  spawnSync("docker", ["rm", "--force", name], { stdio: "ignore" });
  upstream.closeAllConnections();
  await new Promise((resolve) => upstream.close(resolve));
  fs.rmSync(directory, { recursive: true, force: true });
}
