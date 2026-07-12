import { appendFile, mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";

export class RotatingFileLogger {
  private pending: Promise<void> = Promise.resolve();

  constructor(
    readonly filename: string,
    private readonly maxBytes = 20 * 1024 * 1024,
    private readonly backups = 5
  ) {}

  info(message: string, data?: unknown): void { this.write("INFO", message, data); }
  error(message: string, data?: unknown): void { this.write("ERROR", message, data); }

  flush(): Promise<void> { return this.pending; }

  private write(level: string, message: string, data?: unknown): void {
    const suffix = data === undefined ? "" : ` ${safeJson(data)}`;
    const line = `${new Date().toISOString()} ${level} ${message}${suffix}\n`;
    this.pending = this.pending.then(async () => {
      await mkdir(path.dirname(this.filename), { recursive: true, mode: 0o700 });
      const size = await stat(this.filename).then((value) => value.size, () => 0);
      if (size + Buffer.byteLength(line) > this.maxBytes) await this.rotate();
      await appendFile(this.filename, line, { encoding: "utf8", mode: 0o600 });
    }).catch(() => undefined);
  }

  private async rotate(): Promise<void> {
    for (let index = this.backups; index >= 1; index -= 1) {
      const source = index === 1 ? this.filename : `${this.filename}.${index - 1}`;
      const target = `${this.filename}.${index}`;
      await rename(source, target).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      });
    }
  }
}

const safeJson = (value: unknown): string => {
  try { return JSON.stringify(value); } catch { return String(value); }
};
