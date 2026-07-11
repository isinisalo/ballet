import { spawn } from "node:child_process";
import { appendFile, chmod, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
const DEFAULT_BACKUPS = 5;

export interface RotatingTextLogOptions {
  path: string;
  maxBytes?: number;
  backups?: number;
}

/**
 * Serializes writes and rotates only files exclusively owned by this sink.
 * launchd itself writes to /dev/null, so no process can keep a descriptor to a
 * renamed generation and silently bypass rotation.
 */
export class RotatingTextLog {
  private readonly maxBytes: number;
  private readonly backups: number;
  private pending = Promise.resolve();

  constructor(private readonly options: RotatingTextLogOptions) {
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.backups = options.backups ?? DEFAULT_BACKUPS;
    if (!Number.isSafeInteger(this.maxBytes) || this.maxBytes < 1) throw new Error("Log maxBytes must be a positive integer.");
    if (!Number.isSafeInteger(this.backups) || this.backups < 0) throw new Error("Log backups must be a non-negative integer.");
  }

  write(value: string | Buffer): Promise<void> {
    const content = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
    if (content.length === 0) return this.pending;
    this.pending = this.pending.then(async () => {
      await mkdir(path.dirname(this.options.path), { recursive: true });
      const size = await stat(this.options.path).then((metadata) => metadata.size, () => 0);
      if (size > 0 && size + content.length > this.maxBytes) await this.rotate();
      await appendFile(this.options.path, content, { mode: 0o600 });
      await chmod(this.options.path, 0o600);
    });
    return this.pending;
  }

  flush(): Promise<void> {
    return this.pending;
  }

  private async rotate(): Promise<void> {
    if (this.backups === 0) {
      await rm(this.options.path, { force: true });
      return;
    }
    await rm(`${this.options.path}.${this.backups}`, { force: true });
    for (let index = this.backups - 1; index >= 1; index -= 1) {
      await rename(`${this.options.path}.${index}`, `${this.options.path}.${index + 1}`).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      });
    }
    await rename(this.options.path, `${this.options.path}.1`).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
  }
}

export interface LaunchdLogSupervisorOptions {
  entrypoint: string;
  childArguments: readonly string[];
  stdoutPath: string;
  stderrPath: string;
  executable?: string;
  environment?: NodeJS.ProcessEnv;
  shutdownTimeoutMs?: number;
  maxBytes?: number;
  backups?: number;
}

export const superviseLaunchdProcess = async (options: LaunchdLogSupervisorOptions): Promise<number> => {
  const stdout = new RotatingTextLog({ path: options.stdoutPath, maxBytes: options.maxBytes, backups: options.backups });
  const stderr = new RotatingTextLog({ path: options.stderrPath, maxBytes: options.maxBytes, backups: options.backups });
  const child = spawn(options.executable ?? process.execPath, [options.entrypoint, ...options.childArguments], {
    env: options.environment ?? process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let shutdownRequested = false;
  let killTimer: NodeJS.Timeout | undefined;
  const requestShutdown = () => {
    if (shutdownRequested) return;
    shutdownRequested = true;
    child.kill("SIGTERM");
    killTimer = setTimeout(() => child.kill("SIGKILL"), options.shutdownTimeoutMs ?? 10_000);
    killTimer.unref();
  };
  process.once("SIGINT", requestShutdown);
  process.once("SIGTERM", requestShutdown);

  let captureError: unknown;
  const capture = async (stream: NodeJS.ReadableStream, sink: RotatingTextLog) => {
    try {
      await pipe(stream, sink);
    } catch (error) {
      captureError ??= error;
      requestShutdown();
    }
  };
  const stdoutPipe = capture(child.stdout, stdout);
  const stderrPipe = capture(child.stderr, stderr);
  let result = 1;
  try {
    const outcome = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => resolve({ code, signal }));
    });
    result = shutdownRequested ? 0 : outcome.code ?? (outcome.signal ? 1 : 0);
  } catch (error) {
    await stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  } finally {
    if (killTimer) clearTimeout(killTimer);
    process.removeListener("SIGINT", requestShutdown);
    process.removeListener("SIGTERM", requestShutdown);
    await Promise.allSettled([stdoutPipe, stderrPipe]);
    await Promise.allSettled([stdout.flush(), stderr.flush()]);
  }
  return captureError ? 1 : result;
};

const pipe = async (stream: NodeJS.ReadableStream, sink: RotatingTextLog): Promise<void> => {
  for await (const chunk of stream) await sink.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
};

export const supervisedProgramArguments = (
  programArguments: readonly string[],
  service: "daemon" | "server"
): string[] => {
  const expected = `${service}-internal-run`;
  if (programArguments.at(-1) !== expected) throw new Error(`Expected launchd program arguments to end in ${expected}.`);
  return [...programArguments.slice(0, -1), "launchd-log-supervisor-internal-run", service];
};
