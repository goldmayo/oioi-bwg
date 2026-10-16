import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test } from "vitest";

test("host installer copies paired deployment helpers and preserves configuration on repeat", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "oioi-host-assets-"));
  try {
    const bin = join(temporary, "bin");
    const config = join(temporary, "config");
    const runtime = join(temporary, "runtime");
    for (const directory of [bin, config, join(temporary, "sudoers"), join(temporary, "systemd")]) {
      await mkdir(directory);
    }
    for (const [name, body] of Object.entries({
      visudo: 'test "$1" = -cf && test -f "$2"',
      systemctl: 'printf "%s\\n" "$*" >> "$INSTALL_TEST_ROOT/systemctl.log"',
    })) {
      await writeFile(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
    }
    // Only this fixture simulates root ownership and redirects host paths.
    // install/flock, file modes and copied assets are real; visudo/systemd are stubs.
    const installer = (await readFile("ops/oci/install-host-assets.sh", "utf8"))
      .replace('[[ "${EUID}" == "0" ]]', "true")
      .replace(/^repository_root=.*$/m, 'repository_root="${INSTALL_TEST_REPOSITORY}"')
      .replace('runtime_root="/srv/oioibawige"', 'runtime_root="${INSTALL_TEST_ROOT}/runtime"')
      .replace('config_root="/etc/oioibawige"', 'config_root="${INSTALL_TEST_ROOT}/config"')
      .replaceAll("-o root -g root ", "")
      .replaceAll("! -user root -o -perm /022", "-perm /022")
      .replace(
        "runtime, config = map(Path, sys.argv[1:3])",
        `import os
original = Path.lstat
trusted = set(Path(os.environ['INSTALL_TEST_ROOT']).parents)
def simulated(path, *args, **kwargs):
    fields = list(original(path, *args, **kwargs)); fields[4] = 0
    if path in trusted: fields[0] = stat.S_IFDIR | 0o755
    return os.stat_result(fields)
Path.lstat = simulated
runtime, config = map(Path, sys.argv[1:3])`,
      )
      .replaceAll("/etc/sudoers.d", "${INSTALL_TEST_ROOT}/sudoers")
      .replaceAll("/etc/systemd/system", "${INSTALL_TEST_ROOT}/systemd");
    const runInstaller = (...args: string[]) =>
      spawnSync("bash", ["-s", "--", ...args], {
        input: installer,
        encoding: "utf8",
        env: {
          ...process.env,
          INSTALL_TEST_ROOT: temporary,
          INSTALL_TEST_REPOSITORY: resolve("."),
          PATH: `${bin}:${process.env.PATH}`,
        },
        timeout: 10_000,
      });
    const protectedNames = ["deploy.conf", "runtime-public.env", "runtime-secrets.env"];
    for (const repeat of [false, true]) {
      if (repeat) {
        for (const name of protectedNames) {
          await writeFile(join(config, name), `preserved:${name}\n`);
        }
        // A stale installed helper must be updated by a subsequent installation.
        await chmod(join(runtime, "scripts/paired-release.py"), 0o600);
        await writeFile(join(runtime, "scripts/paired-release.py"), "stale helper\n");
      }
      const result = runInstaller();
      expect(result.status, result.stdout + result.stderr).toBe(0);
      for (const script of [
        "deploy-release.sh",
        "paired-release.py",
        "materialize-runtime-env.py",
        "preflight-host.sh",
        "publish-filesystem-metric.sh",
        "run-command-probe.sh",
      ]) {
        const installed = join(runtime, "scripts", script);
        expect(await readFile(installed)).toEqual(await readFile(join("ops/oci", script)));
        expect((await stat(installed)).mode & 0o777).toBe(0o755);
      }
      for (const [index, name] of protectedNames.entries()) {
        const source = [
          "ops/oci/deploy.conf.example",
          "app.env.oci-development.example",
          ".env.oci-secrets.example",
        ][index];
        expect(await readFile(join(config, name), "utf8")).toBe(
          repeat ? `preserved:${name}\n` : await readFile(source, "utf8"),
        );
        expect((await stat(join(config, name))).mode & 0o777).toBe(0o600);
      }
    }
    const legacyFiles = {
      "compose.yml": [
        join(runtime, "compose.oci-development.yml"),
        "services:\n  app:\n    image: legacy\n",
      ],
      "deploy-release.sh": [join(runtime, "scripts/deploy-release.sh"), "#!/bin/sh\nexit 0\n"],
      "deploy.conf": [join(config, "deploy.conf"), "preserved:deploy.conf\n"],
    };
    for (const [path, content] of Object.values(legacyFiles)) await writeFile(path, content);
    await writeFile(join(runtime, "app.env"), "preserved legacy env\n");
    expect(runInstaller().status).toBe(1);
    const upgrade = runInstaller("--upgrade-paired");
    expect(upgrade.status, upgrade.stdout + upgrade.stderr).toBe(0);
    for (const [name, [, content]] of Object.entries(legacyFiles)) {
      const backup = join(runtime, "deploy/legacy-host", name);
      expect(await readFile(backup, "utf8")).toBe(content);
      expect((await stat(backup)).mode & 0o777).toBe(0o600);
    }
    expect(await readFile(join(runtime, "app.env"), "utf8")).toBe("preserved legacy env\n");
    expect(await readFile(join(config, "deploy.conf"), "utf8")).toBe("preserved:deploy.conf\n");
    expect(await readFile(join(runtime, "scripts/paired-release.py"))).toEqual(
      await readFile("ops/oci/paired-release.py"),
    );
    expect(await readFile(join(temporary, "systemctl.log"), "utf8")).toBe(
      "daemon-reload\n".repeat(3),
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
