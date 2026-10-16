import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test } from "vitest";

test.each(["success", "console", "web", "revision"])(
  "paired smoke %s leaves proof only after both images pass together (fake Docker/browser)",
  async (failure) => {
    const root = await mkdtemp(join(tmpdir(), "paired-smoke-"));
    try {
      await writeFile(
        join(root, "docker"),
        `#!/usr/bin/python3
import json,os,pathlib,sys
root=pathlib.Path(os.environ['MOCK_ROOT']); args=sys.argv[1:]
if args[:2]==['image','inspect']:
    if args[-1]=='{{.Architecture}}': print('arm64')
    else: print(('0' if os.environ['MOCK_FAILURE']=='revision' else 'a')*40)
elif args[0]=='run':
    name=args[args.index('--name')+1]; (root/name).touch()
elif args[0]=='rm':
    for name in args[2:]: (root/name).unlink(missing_ok=True)
`,
      );
      await writeFile(
        join(root, "node"),
        `#!/usr/bin/python3
import os,pathlib,sys
root=pathlib.Path(os.environ['MOCK_ROOT']); script=sys.argv[1]
if 'container-native' not in script:
    assert (root/'promotion-smoke').exists() and (root/'console-promotion-smoke').exists()
if os.environ['MOCK_FAILURE'] in ('console','web') and os.environ['MOCK_FAILURE']+'-standalone' in script: sys.exit(1)
`,
      );
      await writeFile(join(root, "curl"), "#!/bin/sh\nexit 0\n");
      await Promise.all(["docker", "node", "curl"].map((name) => chmod(join(root, name), 0o700)));
      const proof = join(root, "smoke.json");
      await writeFile(proof, "stale proof must not survive");
      const result = spawnSync("bash", [resolve("ops/oci/smoke-paired-candidate.sh")], {
        encoding: "utf8",
        timeout: 10_000,
        env: {
          ...process.env,
          PATH: `${root}:${process.env.PATH}`,
          MOCK_ROOT: root,
          MOCK_FAILURE: failure,
          PAIR_SMOKE_FILE: proof,
          GITHUB_RUN_ID: "17",
          GITHUB_RUN_ATTEMPT: "2",
          IMAGE_REPOSITORY: "registry.test/namespace/web",
          CONSOLE_IMAGE_REPOSITORY: "registry.test/namespace/console",
          IMAGE_DIGEST: `sha256:${"b".repeat(64)}`,
          CONSOLE_IMAGE_DIGEST: `sha256:${"c".repeat(64)}`,
          WEB_BUILD_SOURCE_SHA: "a".repeat(40),
          CONSOLE_BUILD_SOURCE_SHA: "a".repeat(40),
        },
      });
      expect(result.status, result.stderr).toBe(failure === "success" ? 0 : 1);
      if (failure === "success")
        expect(JSON.parse(await readFile(proof, "utf8"))).toMatchObject({
          runId: 17,
          runAttempt: 2,
          images: { console: { buildSourceSha: "a".repeat(40) } },
        });
      else await expect(readFile(proof)).rejects.toThrow();
      await expect(readFile(join(root, "promotion-smoke"))).rejects.toThrow();
      await expect(readFile(join(root, "console-promotion-smoke"))).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
