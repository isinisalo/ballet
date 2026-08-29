import { appendFile, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

export interface RotatingDaemonLoggerOptions {
  path: string;
  maxBytes?: number;
  backups?: number;
}

export class RotatingDaemonLogger {
  private readonly maxBytes: number;
  private readonly backups: number;
  private pending = Promise.resolve();

  constructor(private readonly options: RotatingDaemonLoggerOptions) {
    this.maxBytes = options.maxBytes ?? 20 * 1024 * 1024;
    this.backups = options.backups ?? 5;
  }

  log(level: "info" | "warn" | "error", message: string, data?: unknown): Promise<void> {
    const entry = `${JSON.stringify({
      at: new Date().toISOString(),
      level,
      message,
      data: serialize(data)
    })}\n`;
    this.pending = this.pending.then(async () => {
      await mkdir(path.dirname(this.options.path), { recursive: true });
      const size = await stat(this.options.path).then((metadata) => metadata.size, () => 0);
      if (size + Buffer.byteLength(entry) > this.maxBytes) await this.rotate();
      await appendFile(this.options.path, entry, { mode: 0o600 });
    });
    return this.pending;
  }

  private async rotate(): Promise<void> {
    if (this.backups < 1) {
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

const serialize = (value: unknown): unknown => value instanceof Error
  ? { name: value.name, message: value.message, stack: value.stack }
  : value;
