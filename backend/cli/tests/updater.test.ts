import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isHomebrewExecutable, VerifiedReleaseUpdater, verifyChecksum } from "../VerifiedReleaseUpdater.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("VerifiedReleaseUpdater", () => {
  it("fails closed on a missing or mismatched SHA256", () => {
    const archive = Buffer.from("archive");
    expect(() => verifyChecksum("ballet.tar.gz", archive, "")).toThrow("missing or invalid");
    expect(() => verifyChecksum("ballet.tar.gz", archive, `${"0".repeat(64)}  ballet.tar.gz\n`)).toThrow("mismatch");
    const hash = createHash("sha256").update(archive).digest("hex");
    expect(verifyChecksum("ballet.tar.gz", archive, `${hash}  ballet.tar.gz\n`)).toBe(hash);
  });

  it("binds Homebrew detection to the active executable instead of any installed formula", async () => {
    const root = await temporaryRoot("ballet-brew-detection-");
    const brewPrefix = path.join(root, "Cellar", "ballet", "1.0.0");
    const brewed = path.join(brewPrefix, "bin", "ballet");
    const activeBrew = path.join(root, "homebrew", "bin", "ballet");
    const direct = path.join(root, "direct", "bin", "ballet");
    await mkdir(path.dirname(brewed), { recursive: true });
    await mkdir(path.dirname(activeBrew), { recursive: true });
    await mkdir(path.dirname(direct), { recursive: true });
    await writeFile(brewed, "brew");
    await writeFile(direct, "direct");
    await symlink(brewed, activeBrew);
    const run = async () => ({ stdout: `${brewPrefix}\n`, stderr: "" });

    await expect(isHomebrewExecutable(activeBrew, run)).resolves.toBe(true);
    await expect(isHomebrewExecutable(direct, run)).resolves.toBe(false);
  });

  it("verifies attestation before atomically switching one immutable direct-install bundle", async () => {
    const root = await temporaryRoot("ballet-direct-update-");
    const installPath = path.join(root, "prefix", "bin", "ballet");
    await mkdir(path.dirname(installPath), { recursive: true });
    await writeFile(installPath, "old launcher");
    const archive = Buffer.from("attested archive bytes");
    const hash = createHash("sha256").update(archive).digest("hex");
    const commands: string[] = [];
    const run = async (command: string, args: string[]) => {
      commands.push(`${path.basename(command)} ${args.join(" ")}`);
      if (command === "which") return { stdout: "/usr/local/bin/gh\n", stderr: "" };
      if (command === "gh") return { stdout: "verified\n", stderr: "" };
      if (command === "brew") throw new Error("not a Homebrew executable");
      if (command === "tar") {
        const extractionRoot = args[args.indexOf("-C") + 1]!;
        await writeExtractedBundle(extractionRoot);
        return { stdout: "", stderr: "" };
      }
      if (path.basename(command) === "node" && args[0] === "-p") return { stdout: "arm64\n", stderr: "" };
      if (path.basename(command) === "node") return { stdout: "", stderr: "" };
      if (path.basename(command) === "ballet" && args[0] === "version") return { stdout: "1.2.3\n", stderr: "" };
      throw new Error(`Unexpected command ${command} ${args.join(" ")}`);
    };
    const updater = new VerifiedReleaseUpdater({
      installPath,
      platform: "darwin",
      architecture: "arm64",
      runCommand: run,
      fetch: releaseFetch(archive, hash)
    });

    await expect(updater.update()).resolves.toBe("Ballet was updated to v1.2.3.");
    expect((await lstat(installPath)).isSymbolicLink()).toBe(true);
    const activeLauncher = await realpath(installPath);
    expect(activeLauncher).toContain(`${path.sep}libexec${path.sep}ballet${path.sep}versions${path.sep}`);
    const bundle = path.dirname(activeLauncher);
    await expect(readFile(path.join(bundle, "share", "ballet", "dist", "index.html"), "utf8")).resolves.toBe("frontend");
    await expect(readFile(path.join(bundle, "libexec", "ballet", "dist-server", "backend", "cli", "main.js"), "utf8")).resolves.toBe("server");
    expect(commands.findIndex((entry) => entry.startsWith("gh attestation verify")))
      .toBeLessThan(commands.findIndex((entry) => entry.startsWith("tar -xzf")));
  });
});

const temporaryRoot = async (prefix: string) => {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  roots.push(root);
  return root;
};

const releaseFetch = (archive: Buffer, hash: string): typeof fetch => async (input) => {
  const url = String(input);
  if (url.includes("/releases/latest")) {
    return Response.json({
      tag_name: "v1.2.3",
      assets: [
        { name: "ballet_1.2.3_darwin_arm64.tar.gz", browser_download_url: "https://download.test/archive" },
        { name: "checksums.txt", browser_download_url: "https://download.test/checksums" }
      ]
    });
  }
  if (url.endsWith("/archive")) return new Response(archive);
  if (url.endsWith("/checksums")) return new Response(`${hash}  ballet_1.2.3_darwin_arm64.tar.gz\n`);
  return new Response("not found", { status: 404 });
};

const writeExtractedBundle = async (root: string): Promise<void> => {
  const runtime = path.join(root, "libexec", "ballet");
  await mkdir(path.join(runtime, "dist-server", "backend", "cli"), { recursive: true });
  await mkdir(path.join(runtime, "node_modules", "better-sqlite3"), { recursive: true });
  await mkdir(path.join(root, "share", "ballet", "dist"), { recursive: true });
  await writeFile(path.join(root, "ballet"), "launcher", { mode: 0o755 });
  await writeFile(path.join(runtime, "node"), "node", { mode: 0o755 });
  await writeFile(path.join(runtime, "dist-server", "backend", "cli", "main.js"), "server");
  await writeFile(path.join(runtime, "node_modules", "better-sqlite3", "package.json"), "{}");
  await writeFile(path.join(root, "share", "ballet", "dist", "index.html"), "frontend");
};
