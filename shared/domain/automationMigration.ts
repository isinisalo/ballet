type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOwn = (value: JsonRecord, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const hasExactKeys = (value: JsonRecord, keys: string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => hasOwn(value, key));

const isLegacyTarget = (value: unknown): boolean =>
  typeof value === "string"
  || (isRecord(value) && Object.keys(value).length === 1 && typeof value.loop === "string");

const isBinaryTransitions = (value: unknown): value is JsonRecord & {
  approved: unknown;
  rejected: unknown;
} => isRecord(value)
  && Object.keys(value).length === 2
  && hasOwn(value, "approved")
  && hasOwn(value, "rejected")
  && isLegacyTarget(value.approved)
  && isLegacyTarget(value.rejected);

const isGenericAction = (value: unknown): boolean => isRecord(value)
  && ["goto", "terminate", "wait", "retry"].includes(String(value.action));

/**
 * Upgrades the two legacy v8 transition shapes to the canonical v8 action model.
 * Invalid legacy values are deliberately left malformed so the strict schema
 * reports them instead of silently inventing behavior.
 */
export const migrateAutomationConfig = (value: unknown): unknown => {
  if (!isRecord(value) || value.version !== 8 || !Array.isArray(value.loops)) return value;
  return {
    ...value,
    version: 8,
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
  if (!isRecord(value) || !isRecord(value.on)) return value;
  if (value.type === "human") return migrateHumanNode(value, nodes);
  if (value.type !== "agent" && value.type !== "scheduled") return value;

  const legacy = isBinaryTransitions(value.on)
    ? expandBinaryAgentTransitions(value.on, nodes)
    : value.on;
  if (!hasOutcomeTransitions(legacy)) return value;
  if (Object.values(legacy).every(isGenericAction)) return { ...value, on: legacy };
  if (!isOpinionatedAgentTransitions(legacy)) return value;

  return {
    ...value,
    on: {
      ready: goto(legacy.ready),
      approved: goto(legacy.approved),
      "changes-requested": migrateChangesRequested(legacy["changes-requested"]),
      needs_input: migrateNeedsInput(legacy.needs_input),
      blocked: migrateTerminal(legacy.blocked, "blocked"),
      failed: migrateFailed(legacy.failed)
    }
  };
};

const migrateHumanNode = (value: JsonRecord, nodes: unknown[]): unknown => {
  if (!isBinaryTransitions(value.on)) return value;
  const rejectedNode = typeof value.on.rejected === "string"
    ? nodeById(nodes, value.on.rejected)
    : undefined;
  return {
    ...value,
    on: {
      approved: goto(value.on.approved, "append-signal"),
      rejected: rejectedNode?.type === "agent"
        ? retry(value.on.rejected, 3, terminate("blocked"), undefined, "append-signal")
        : goto(value.on.rejected, "append-signal")
    }
  };
};

const hasOutcomeTransitions = (value: unknown): value is JsonRecord => isRecord(value)
  && ["ready", "approved", "changes-requested", "needs_input", "blocked", "failed"]
    .every((key) => hasOwn(value, key));

const isOpinionatedAgentTransitions = (value: JsonRecord): boolean =>
  hasExactKeys(value, ["ready", "approved", "changes-requested", "needs_input", "blocked", "failed"])
  && isLegacyTarget(value.ready)
  && isLegacyTarget(value.approved)
  && isLegacyChangesRequested(value["changes-requested"])
  && isLegacyNeedsInput(value.needs_input)
  && isLegacyTerminal(value.blocked, "blocked")
  && isLegacyFailed(value.failed);

const isLegacyChangesRequested = (value: unknown): boolean => isRecord(value)
  && ((hasExactKeys(value, ["repair"]) && typeof value.repair === "string")
    || (hasExactKeys(value, ["terminate"]) && value.terminate === "blocked"));

const isLegacyNeedsInput = (value: unknown): boolean => isRecord(value)
  && ((hasExactKeys(value, ["human"]) && typeof value.human === "string")
    || (hasExactKeys(value, ["wait"]) && value.wait === true));

const isLegacyTerminal = (value: unknown, status: string): boolean =>
  isRecord(value) && hasExactKeys(value, ["terminal"]) && value.terminal === status;

const isLegacyFailed = (value: unknown): boolean => {
  if (!isRecord(value) || value.terminal !== "failed") return false;
  if (hasExactKeys(value, ["terminal"])) return true;
  return hasExactKeys(value, ["terminal", "retry"])
    && isRecord(value.retry)
    && hasExactKeys(value.retry, ["when", "limit"])
    && value.retry.when === "transient"
    && value.retry.limit === 1;
};

const expandBinaryAgentTransitions = (on: JsonRecord, nodes: unknown[]): JsonRecord => ({
  ready: on.approved,
  approved: on.approved,
  "changes-requested": repairTransition(on.rejected, nodes),
  needs_input: needsInputTransition(on.approved, on.rejected, nodes),
  blocked: { terminal: "blocked" },
  failed: { terminal: "failed", retry: { when: "transient", limit: 1 } }
});

const migrateChangesRequested = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  if (typeof value.repair === "string") {
    return retry(value.repair, 3, terminate("blocked"), "same-evidence");
  }
  if (value.terminate === "blocked") return terminate("blocked");
  return value;
};

const migrateNeedsInput = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  if (typeof value.human === "string") return goto(value.human, "signal");
  if (value.wait === true) return { action: "wait", resume: "same-step", input: "append-signal" };
  return value;
};

const migrateTerminal = (value: unknown, fallback: string): unknown => {
  if (!isRecord(value)) return value;
  return typeof value.terminal === "string" ? terminate(value.terminal) : terminate(fallback);
};

const migrateFailed = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  const status = typeof value.terminal === "string" ? value.terminal : "failed";
  if (!isRecord(value.retry)) return terminate(status);
  const maxAttempts = value.retry.limit;
  return retry(undefined, maxAttempts, terminate(status), undefined, undefined, {
    failureClassification: value.retry.when === "transient" ? "transient" : value.retry.when
  });
};

const goto = (target: unknown, input?: string): JsonRecord => ({
  action: "goto",
  target,
  ...(input ? { input } : {})
});

const terminate = (status: unknown): JsonRecord => ({ action: "terminate", status });

const retry = (
  target: unknown,
  maxAttempts: unknown,
  onExhausted: JsonRecord,
  stallDetection?: string,
  input?: string,
  when?: JsonRecord
): JsonRecord => ({
  action: "retry",
  ...(typeof target === "string" ? { target } : {}),
  ...(input ? { input } : {}),
  policy: {
    maxAttempts,
    onExhausted,
    ...(when ? { when } : {}),
    ...(stallDetection ? { stallDetection } : {})
  }
});

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
    if ((node.type !== "agent" && node.type !== "scheduled") || !isBinaryTransitions(node.on)) return undefined;
    target = node.on.approved;
  }
  return undefined;
};

const nodeById = (nodes: unknown[], id: string): JsonRecord | undefined =>
  nodes.find((node): node is JsonRecord => isRecord(node) && node.id === id);
