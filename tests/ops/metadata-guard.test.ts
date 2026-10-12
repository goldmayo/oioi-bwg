import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, expect, test } from "vitest";

const roots: string[] = [];
const table = "oioi_metadata_guard";
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "oioi-metadata-"));
  roots.push(root);
  const state = {
    nftables: [
      { table: { family: "inet", name: table } },
      {
        chain: {
          family: "inet",
          table,
          name: "forward",
          type: "filter",
          hook: "forward",
          prio: -10,
          policy: "accept",
        },
      },
      {
        rule: {
          family: "inet",
          table,
          chain: "forward",
          expr: [
            {
              match: {
                op: "==",
                left: { payload: { protocol: "ip", field: "daddr" } },
                right: "169.254.169.254",
              },
            },
            { counter: { packets: 10, bytes: 600 } },
            { drop: null },
          ],
        },
      },
    ],
  };
  await writeFile(join(root, "state.json"), JSON.stringify(state));
  const binaries = {
    nft: `#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
p=Path(os.environ['STATE'])
if '-j' in sys.argv:
 data=json.loads(p.read_text()); print(json.dumps(data))
 if not os.environ.get('NO_COUNTER'):
  data['nftables'][2]['rule']['expr'][1]['counter']['packets']+=6; p.write_text(json.dumps(data))
else:
 Path(os.environ['TRANSACTION']).write_text(sys.stdin.read())
 if os.environ.get('NFT_FAIL'): print('private-response',file=sys.stderr); sys.exit(1)
`,
    curl: `#!/usr/bin/env python3
import os
print(os.environ.get('HOST_STATUS','200'),end='')
`,
    docker: `#!/usr/bin/env python3
import json,os,subprocess,sys
if sys.argv[2]=='inspect':
 print(json.dumps({'mode':os.environ.get('NETWORK_MODE','bridge'),'privileged':False,'caps':None,'mounts':[],'networks':{'bridge':{}}}))
elif sys.argv[2]=='network': print('bridge')
else:
 bootstrap="""import client from 'node:http'; import {EventEmitter} from 'node:events';
 client.get=(options,callback)=>{
  if(options.host!=='169.254.169.254'||options.headers.Authorization!=='Bearer Oracle') throw new Error();
  const req=new EventEmitter(); req.destroy=()=>{};
  process.nextTick(()=>{if(process.env.HTTP_STATUS) callback({statusCode:Number(process.env.HTTP_STATUS),destroy(){}});
   else req.emit('error',Object.assign(new Error('private-response'),{code:'EHOSTUNREACH'}));req.emit('close');});return req;
 };"""
 result=subprocess.run(['node','--input-type=module','-',sys.argv[-1]],input=bootstrap+sys.stdin.read(),text=True,capture_output=True)
 sys.stdout.write(result.stdout);sys.stderr.write(result.stderr);sys.exit(result.returncode)
`,
  };
  for (const [name, source] of Object.entries(binaries)) {
    await writeFile(join(root, name), source);
    await chmod(join(root, name), 0o755);
  }
  return { root, state };
}
function execute(root: string, args: string[], extra = {}) {
  return spawnSync("python3", [resolve("ops/oci/metadata-guard.py"), ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${root}:${process.env.PATH}`,
      STATE: join(root, "state.json"),
      TRANSACTION: join(root, "transaction"),
      PYTHONOPTIMIZE: "1",
      ...extra,
    },
  });
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("applies only the owned table as one checked transaction and hides nft diagnostics", async () => {
  const { root } = await fixture();
  expect(execute(root, ["apply"]).status).toBe(0);
  const transaction = await readFile(join(root, "transaction"), "utf8");
  expect(transaction).toContain(`delete table inet ${table}`);
  expect(transaction).not.toContain("flush ruleset");
  const failure = execute(root, ["apply"], { NFT_FAIL: "1" });
  expect(failure.status).toBe(1);
  expect(failure.stderr).toBe('{"event":"metadata_guard_failed"}\n');
});
test.each(["hook", "priority", "destination", "verdict", "extra-rule"])(
  "rejects %s drift even with Python optimization enabled",
  async (change) => {
    const { root, state } = await fixture();
    if (change === "hook") state.nftables[1].chain!.hook = "input";
    if (change === "priority") state.nftables[1].chain!.prio = 10;
    if (change === "destination") state.nftables[2].rule!.expr[0].match!.right = "127.0.0.1";
    if (change === "extra-rule") state.nftables.push(state.nftables[2]);
    const serialized = JSON.stringify(state);
    await writeFile(
      join(root, "state.json"),
      change === "verdict" ? serialized.replace('"drop":null', '"accept":null') : serialized,
    );
    expect(execute(root, ["check"]).status).toBe(1);
  },
);
test("requires host positives and counter growth around six direct, body-free requests", async () => {
  const { root } = await fixture();
  const result = execute(root, ["probe", "web"]);
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toBe('{"event":"metadata_guard_passed"}\n');
  expect(execute(root, ["probe", "web"], { NO_COUNTER: "1" }).status).toBe(1);
  expect(execute(root, ["probe", "web"], { HOST_STATUS: "503" }).status).toBe(1);
  expect(execute(root, ["probe", "web"], { NETWORK_MODE: "host" }).status).toBe(1);
});
test.each(["200", "401", "404", "500"])(
  "HTTP %s is not network isolation evidence",
  async (HTTP_STATUS) => {
    const { root } = await fixture();
    const result = execute(root, ["probe", "web"], { HTTP_STATUS });
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('{"event":"metadata_guard_failed"}\n');
    expect(result.stdout + result.stderr).not.toContain("private-response");
  },
);
test("rejects unexpected commands and container selectors", async () => {
  const { root } = await fixture();
  expect(execute(root, ["remove"]).status).toBe(1);
  expect(execute(root, ["probe", "--privileged"]).status).toBe(1);
});
