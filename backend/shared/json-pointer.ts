import { isRecord } from "./json.js";

export interface JsonPointerLookup {
  found: boolean;
  value?: unknown;
}

export class JsonPointerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JsonPointerError";
  }
}

export const decodePointerSegment = (segment: string): string =>
  segment.replace(/~1/g, "/").replace(/~0/g, "~");

export const encodePointerSegment = (segment: string): string =>
  segment.replace(/~/g, "~0").replace(/\//g, "~1");

export const parseJsonPointer = (path: string): string[] => {
  if (path === "") return [];
  if (!path.startsWith("/")) throw new JsonPointerError(`JSON Pointer must start with "/": ${path}`);
  return path.slice(1).split("/").map(decodePointerSegment);
};

export const getByJsonPointer = (source: unknown, path: string): JsonPointerLookup => {
  const segments = parseJsonPointer(path);
  let current = source;

  for (const segment of segments) {
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/.test(segment)) return { found: false };
      const index = Number(segment);
      if (index >= current.length) return { found: false };
      current = current[index];
      continue;
    }

    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return { found: false };
    }
    current = current[segment];
  }

  return { found: true, value: current };
};

