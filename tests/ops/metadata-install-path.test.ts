import { spawnSync } from "node:child_process";
import { chmod, link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

test.each([
  "safe",
  "user-directory",
  "writable-directory",
  "symlink-directory",
  "symlink-file",
  "hardlinked-file",
  "user-file",
  "writable-file",
])("installation preflight handles %s without modifying assets", async (scenario) => {
  const temporary = await mkdtemp(join(tmpdir(), "oioi-install-path-"));
  try {
    const root = join(temporary, "guard");
    await mkdir(root);
    const target = join(root, "metadata-guard.py");
    const sentinel = join(temporary, "sentinel");
    await writeFile(sentinel, "unchanged");
    if (scenario === "writable-directory") await chmod(root, 0o777);
    if (scenario === "symlink-directory") {
      await rm(root, { recursive: true });
      await symlink(temporary, root);
    } else if (scenario === "symlink-file") {
      await symlink(sentinel, target);
    } else if (scenario === "hardlinked-file") {
      await link(sentinel, target);
    } else {
      await writeFile(target, "unchanged");
      if (scenario === "writable-file") await chmod(target, 0o666);
    }
    const installer = await readFile("ops/oci/install-metadata-guard.sh", "utf8");
    const source = installer.split("<<'PYTHON'\n")[1]?.split("\nPYTHON")[0];
    expect(source).toBeTruthy();
    // File kinds, modes and hardlink counts are real; root ownership and trusted temp
    // ancestors are simulated because the test runner must not require root.
    const bootstrap = `import os,stat,sys
from pathlib import Path
root=Path(sys.argv[1]); scenario=sys.argv[2]; original=Path.lstat
trusted=set(root.parents)
def simulated(path,*args,**kwargs):
 info=original(path,*args,**kwargs); fields=list(info)
 fields[4]=0
 if path in trusted: fields[0]=stat.S_IFDIR|0o755
 if scenario=='user-directory' and path==root: fields[4]=1002
 if scenario=='user-file' and path==root/'metadata-guard.py': fields[4]=1002
 return os.stat_result(fields)
Path.lstat=simulated
`;
    const result = spawnSync("python3", ["-I", "-", root, scenario], {
      input: bootstrap + source,
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(scenario === "safe" ? 0 : 1);
    expect(await readFile(sentinel, "utf8")).toBe("unchanged");
    if (scenario !== "safe") {
      expect(result.stderr).toBe("Metadata guard installation path is not root-protected\n");
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
