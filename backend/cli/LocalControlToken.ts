import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const localControlToken = async (balletHome: string): Promise<string> => {
  const target = path.join(balletHome, "server", "control-token");
  try {
    const existing = (await readFile(target, "utf8")).trim();
    if (existing.length >= 32) return existing;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await mkdir(path.dirname(target), { recursive: true });
  const token = randomBytes(32).toString("base64url");
  try {
    await writeFile(target, `${token}\n`, { flag: "wx", mode: 0o600 });
    return token;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = (await readFile(target, "utf8")).trim();
    if (existing.length < 32) throw new Error("The Ballet local control token is invalid.");
    return existing;
  }
};
