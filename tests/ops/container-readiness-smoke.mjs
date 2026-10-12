import assert from "node:assert/strict";

const origin = new URL(process.argv[2]);
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
const response = await fetch(new URL("/readyz", origin), { signal: AbortSignal.timeout(15_000) });
assert.equal(response.status, 200);
assert.equal(response.headers.get("cache-control"), "no-store");
assert.deepEqual(await response.json(), { status: "ready" });
console.log("Container readiness passed with PostgreSQL");
