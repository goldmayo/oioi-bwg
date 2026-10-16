import { spawnSync } from "node:child_process";
import { chmod, link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

for (const command of ["install-host-assets.sh", "preflight-host.sh"]) {
  const scenarios = ["safe", "missing-scripts"];
  for (const directory of ["ancestor", "runtime", "scripts", "deploy", "config"]) {
    scenarios.push(`${directory}-owner`, `${directory}-writable`, `${directory}-symlink`);
  }
  if (command === "install-host-assets.sh") {
    scenarios.push(
      "helper-symlink",
      "helper-hardlink",
      "helper-owner",
      "helper-writable",
      "lock-symlink",
    );
  }
  test.each(scenarios)(`${command} rejects replaceable paths: %s`, async (scenario) => {
    const temporary = await mkdtemp(join(tmpdir(), "oioi-host-path-"));
    try {
      const ancestor = join(temporary, "ancestor");
      const runtime = join(ancestor, "runtime");
      const config = join(ancestor, "config");
      const paths: Record<string, string> = {
        ancestor,
        runtime,
        config,
        scripts: join(runtime, "scripts"),
        deploy: join(runtime, "deploy"),
        helper: join(runtime, "scripts/paired-release.py"),
        lock: join(runtime, "deploy/deployment.lock"),
      };
      for (const path of [paths.scripts, paths.deploy, config])
        await mkdir(path, { recursive: true });
      const sentinel = join(temporary, "sentinel");
      await writeFile(sentinel, "unchanged");
      await writeFile(paths.helper, "helper");
      await writeFile(paths.lock, "lock");
      const [name, kind] = scenario.split("-");
      const target = paths[name] ?? paths.scripts;
      if (kind === "writable") await chmod(target, 0o777);
      if (kind === "symlink" || kind === "hardlink") {
        await rm(target, { recursive: true, force: true });
        if (kind === "hardlink") await link(sentinel, target);
        else await symlink(sentinel, target);
      }
      if (scenario === "missing-scripts") await rm(paths.scripts, { recursive: true });
      const script = await readFile(join("ops/oci", command), "utf8");
      const source = script.split("<<'PYTHON'\n")[1]?.split("\nPYTHON")[0];
      expect(source).toBeTruthy();
      // Modes, kinds and hardlinks are real. Simulate root UID and protected
      // temporary ancestors because this test must also run without root.
      const bootstrap = `import os,stat,sys
from pathlib import Path
temporary=Path(sys.argv[3]); target=Path(sys.argv[4]); scenario=sys.argv[5]
sys.argv=sys.argv[:3]+['paired-release.py']
original=Path.lstat
trusted={temporary,*temporary.parents}
def simulated(path,*args,**kwargs):
    fields=list(original(path,*args,**kwargs)); fields[4]=0
    if path in trusted: fields[0]=stat.S_IFDIR|0o755
    if scenario.endswith('-owner') and path==target: fields[4]=1002
    return os.stat_result(fields)
Path.lstat=simulated
`;
      const result = spawnSync(
        "python3",
        ["-I", "-", runtime, config, temporary, target, scenario],
        {
          input: bootstrap + source,
          encoding: "utf8",
        },
      );
      const allowed =
        scenario === "safe" || (scenario === "missing-scripts" && command.startsWith("install"));
      expect(result.status, result.stderr).toBe(allowed ? 0 : 1);
      if (!allowed)
        expect(result.stderr).toMatch(
          /^Host (installation|preflight) path is not root-protected\n$/,
        );
      expect(await readFile(sentinel, "utf8")).toBe("unchanged");
      // The installer gate must precede lock creation; preflight precedes OCI.
      const gateEnd = script.indexOf("\nPYTHON");
      expect(gateEnd).toBeLessThan(
        script.indexOf(command.startsWith("install") ? "\ninstall -d" : "\nif docker info"),
      );
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
}
