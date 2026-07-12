import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface GitHubRelease {
  tag_name: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

export interface VerifiedReleaseUpdaterOptions {
  repository?: string;
  installPath?: string;
  fetch?: typeof fetch;
  runCommand?: CommandRunner;
  platform?: NodeJS.Platform;
  architecture?: NodeJS.Architecture;
}

type CommandRunner = (
  command: string,
  args: string[],
  options?: { cwd?: string }
) => Promise<{ stdout: string; stderr: string }>;

const runCommand: CommandRunner = async (command, args, options) => {
  const result = await execFileAsync(command, args, options);
  return { stdout: String(result.stdout), stderr: String(result.stderr) };
};

export class VerifiedReleaseUpdater {
  private readonly repository: string;
  private readonly fetchImpl: typeof fetch;
  private readonly run: CommandRunner;
  private readonly platform: NodeJS.Platform;
  private readonly architecture: NodeJS.Architecture;

  constructor(private readonly options: VerifiedReleaseUpdaterOptions = {}) {
    this.repository = options.repository ?? process.env.BALLET_RELEASE_REPOSITORY ?? "isinisalo/ballet";
    this.fetchImpl = options.fetch ?? fetch;
    this.run = options.runCommand ?? runCommand;
    this.platform = options.platform ?? process.platform;
    this.architecture = options.architecture ?? process.arch;
  }

  async update(): Promise<string> {
    if (this.platform !== "darwin") throw new Error("Ballet updates currently support macOS only.");
    if (this.architecture !== "arm64" && this.architecture !== "x64") throw new Error(`Unsupported release architecture: ${this.architecture}.`);
    const installPath = this.options.installPath ?? process.env.BALLET_INSTALL_PATH;
    if (!installPath) throw new Error("Cannot determine the Ballet executable install path. Use `brew upgrade ballet` or set BALLET_INSTALL_PATH.");
    await requireCommand(this.run, "gh", "GitHub CLI is required to verify release attestations. Install it with `brew install gh`.");
    const release = await this.json<GitHubRelease>(`https://api.github.com/repos/${this.repository}/releases/latest`);
    const version = release.tag_name.replace(/^v/, "");
    const architecture = this.architecture;
    const assetName = `ballet_${version}_darwin_${architecture}.tar.gz`;
    const asset = release.assets.find((candidate) => candidate.name === assetName);
    const checksums = release.assets.find((candidate) => candidate.name === "checksums.txt");
    if (!asset || !checksums) throw new Error(`Release ${release.tag_name} is missing ${assetName} or checksums.txt.`);
    const root = await mkdtemp(path.join(os.tmpdir(), "ballet-update-"));
    try {
      const archivePath = path.join(root, assetName);
      const archive = await this.bytes(asset.browser_download_url);
      const checksumText = (await this.bytes(checksums.browser_download_url)).toString("utf8");
      const checksum = verifyChecksum(assetName, archive, checksumText);
      await writeFile(archivePath, archive, { mode: 0o600 });
      await this.run("gh", ["attestation", "verify", archivePath, "--repo", this.repository]);
      if (await isHomebrewExecutable(installPath, this.run)) {
        await this.run("brew", ["upgrade", "ballet"]);
        const installedVersion = (await this.run(installPath, ["version"])).stdout.trim();
        if (installedVersion !== version) {
          throw new Error(`Homebrew installed Ballet ${installedVersion || "unknown"}, expected verified release ${version}.`);
        }
        return `Ballet ${release.tag_name} was attestation-verified and updated with Homebrew.`;
      }
      await this.run("tar", ["-xzf", archivePath, "-C", root]);
      const extractedLauncher = path.join(root, "ballet");
      const extractedRuntime = path.join(root, "libexec", "ballet");
      const extractedShare = path.join(root, "share", "ballet");
      const extractedNode = path.join(extractedRuntime, "node");
      await readFile(path.join(extractedRuntime, "dist-server", "backend", "cli", "main.js"));
      await readFile(path.join(extractedRuntime, "node_modules", "better-sqlite3", "package.json"));
      await readFile(path.join(extractedShare, "dist", "index.html"));
      await chmod(extractedLauncher, 0o755);
      await chmod(extractedNode, 0o755);
      const packagedArchitecture = (await this.run(extractedNode, ["-p", "process.arch"])).stdout.trim();
      if (packagedArchitecture !== architecture) throw new Error(`Release Node runtime is ${packagedArchitecture}, expected ${architecture}.`);
      await this.run(extractedNode, ["-e", 'require("better-sqlite3")'], { cwd: extractedRuntime });
      await installDirectBundle({
        root,
        installPath,
        version,
        checksum,
        run: this.run
      });
      return `Ballet was updated to ${release.tag_name}.`;
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  private async json<T>(url: string): Promise<T> {
    const response = await this.fetchImpl(url, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(`Release lookup returned ${response.status}.`);
    return await response.json() as T;
  }

  private async bytes(url: string): Promise<Buffer> {
    const response = await this.fetchImpl(url, { headers: { Accept: "application/octet-stream" } });
    if (!response.ok) throw new Error(`Release download returned ${response.status}.`);
    return Buffer.from(await response.arrayBuffer());
  }
}

export const verifyChecksum = (assetName: string, content: Buffer, manifest: string): string => {
  const line = manifest.split(/\r?\n/).find((candidate) => candidate.trim().endsWith(`  ${assetName}`));
  const expected = line?.trim().split(/\s+/)[0];
  if (!expected || !/^[0-9a-f]{64}$/i.test(expected)) throw new Error(`Checksum for ${assetName} is missing or invalid.`);
  const actual = createHash("sha256").update(content).digest("hex");
  if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error(`Checksum mismatch for ${assetName}.`);
  return expected.toLowerCase();
};

export const isHomebrewExecutable = async (installPath: string, run: CommandRunner = runCommand): Promise<boolean> => {
  try {
    const { stdout } = await run("brew", ["--prefix", "ballet"]);
    const brewLauncher = path.join(stdout.trim(), "bin", "ballet");
    const [active, brewed] = await Promise.all([realpath(installPath), realpath(brewLauncher)]);
    return active === brewed;
  } catch {
    return false;
  }
};

const requireCommand = async (run: CommandRunner, command: string, message: string): Promise<void> => {
  try {
    await run("which", [command]);
  } catch {
    throw new Error(message);
  }
};

const installDirectBundle = async (input: {
  root: string;
  installPath: string;
  version: string;
  checksum: string;
  run: CommandRunner;
}): Promise<void> => {
  const binDirectory = path.dirname(input.installPath);
  if (path.basename(input.installPath) !== "ballet" || path.basename(binDirectory) !== "bin") {
    throw new Error("The direct-install executable must be located at <prefix>/bin/ballet.");
  }
  const prefix = path.dirname(binDirectory);
  if (prefix === path.parse(prefix).root) throw new Error("Refusing to install a Ballet bundle at the filesystem root.");
  const versions = path.join(prefix, "libexec", "ballet", "versions");
  await mkdir(versions, { recursive: true });
  const safeVersion = input.version.replace(/[^0-9A-Za-z._-]/g, "-");
  const bundle = await mkdtemp(path.join(versions, `ballet-${safeVersion}-${input.checksum.slice(0, 16)}-`));
  let activated = false;
  try {
    await cp(path.join(input.root, "ballet"), path.join(bundle, "ballet"));
    await cp(path.join(input.root, "libexec"), path.join(bundle, "libexec"), { recursive: true });
    await cp(path.join(input.root, "share"), path.join(bundle, "share"), { recursive: true });
    const launcher = path.join(bundle, "ballet");
    const runtime = path.join(bundle, "libexec", "ballet");
    const node = path.join(runtime, "node");
    await chmod(launcher, 0o755);
    await chmod(node, 0o755);
    if ((await input.run(launcher, ["version"])).stdout.trim() !== input.version) {
      throw new Error("The verified Ballet bundle failed its version check.");
    }
    await input.run(node, ["-e", 'require("better-sqlite3")'], { cwd: runtime });
    const replacement = path.join(binDirectory, `.ballet.${process.pid}.new`);
    await rm(replacement, { force: true });
    await symlink(path.relative(binDirectory, launcher), replacement);
    await rename(replacement, input.installPath);
    activated = true;
  } catch (error) {
    if (!activated) await rm(bundle, { recursive: true, force: true });
    throw error;
  }
};
