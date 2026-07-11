import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const opaqueToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");

export const pairingCode = (): string => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(10);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
};

export const tokenHash = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

export const valueHash = (value: unknown): string =>
  tokenHash(stableJson(value));

export const passwordDigest = (password: string, salt: string): string =>
  scryptSync(password, salt, 32).toString("hex");

export const secureEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

