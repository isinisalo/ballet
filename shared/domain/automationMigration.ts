type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOwn = (value: JsonRecord, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const hasBinaryTransitions = (value: unknown): value is JsonRecord & {
  approved: unknown;
  rejected: unknown;
} => isRecord(value)
  && Object.keys(value).length === 2
  && hasOwn(value, "approved")
  && hasOwn(value, "rejected")
  && !hasOwn(value, "ready")
  && !hasOwn(value, "changes-requested")
  && !hasOwn(value, "needs_input")
  && !hasOwn(value, "blocked")
  && !hasOwn(value, "failed");

/**
 * Normalizes only the binary transition shape previously written by v8.
 * It deliberately leaves v7 and malformed values untouched so the strict
 * canonical schema can reject them with their original paths.
 */
export const migrateLegacyBinaryV8 = (value: unknown): unknown => {
  if (!isRecord(value) || value.version !== 8 || !Array.isArray(value.loops)) return value;
  return {
    ...value,
    loops: value.loops.map((candidate) => migrateLoop(candidate))
  };
};

const migrateLoop = (value: unknown): unknown => {
  if (!isRecord(value) || !Array.isArray(value.nodes)) return value;
  const nodes = value.nodes as unknown[];
  return {
    ...value,
    nodes: nodes.map((candidate) => migrateNode(candidate, nodes))
  };
};

const migrateNode = (value: unknown, nodes: unknown[]): unknown => {
  if (!isRecord(value) || !hasBinaryTransitions(value.on)) return value;
  if (value.type === "human") return value;
  if (value.type !== "agent" && value.type !== "scheduled") return value;

  const approved = value.on.approved;
  const rejected = value.on.rejected;
  return {
    ...value,
    on: {
      ready: approved,
      approved,
      "changes-requested": repairTransition(rejected, nodes),
      needs_input: needsInputTransition(approved, rejected, nodes),
      blocked: { terminal: "blocked" },
      failed: { terminal: "failed", retry: { when: "transient", limit: 1 } }
    }
  };
};

const repairTransition = (target: unknown, nodes: unknown[]): JsonRecord => {
  if (typeof target !== "string") return { terminate: "blocked" };
  const node = nodeById(nodes, target);
  return node?.type === "agent" ? { repair: target } : { terminate: "blocked" };
};

const needsInputTransition = (approved: unknown, rejected: unknown, nodes: unknown[]): JsonRecord => {
  const direct = [rejected, approved]
    .filter((target): target is string => typeof target === "string")
    .map((target) => nodeById(nodes, target))
    .find((node) => node?.type === "human");
  if (direct && typeof direct.id === "string") return { human: direct.id };

  const reachable = firstReachableHuman(approved, nodes);
  if (reachable) return { human: reachable };
  const fallback = nodes.find((node): node is JsonRecord => isRecord(node) && node.type === "human");
  return fallback && typeof fallback.id === "string" ? { human: fallback.id } : { wait: true };
};

const firstReachableHuman = (initial: unknown, nodes: unknown[]): string | undefined => {
  let target = initial;
  const visited = new Set<string>();
  while (typeof target === "string" && !visited.has(target)) {
    visited.add(target);
    const node = nodeById(nodes, target);
    if (!node) return undefined;
    if (node.type === "human") return target;
    if ((node.type !== "agent" && node.type !== "scheduled") || !hasBinaryTransitions(node.on)) return undefined;
    target = node.on.approved;
  }
  return undefined;
};

const nodeById = (nodes: unknown[], id: string): JsonRecord | undefined =>
  nodes.find((node): node is JsonRecord => isRecord(node) && node.id === id);
