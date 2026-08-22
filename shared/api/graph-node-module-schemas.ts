import { z } from "zod";
import {
  canvasNodeSizes,
  canvasNodeStyles,
  maxJobRetriesLimit,
  type JsonValue
} from "../domain/automation.js";
import {
  maxGraphNodeModuleNodes,
  maxGraphNodeModuleResourceBodyBytes,
  maxGraphNodeModuleResources,
  maxGraphNodeModuleRules,
  maxGraphNodeModuleStringLength,
  type GraphNodeModulePackageV4
} from "../domain/graphNodeModules.js";
import { nodeCapabilitySchema } from "./workspace-schemas.js";

const localKey = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const stateKey = z.string().min(1).max(100).regex(/^[A-Za-z][A-Za-z0-9_-]*$/);
const shortText = z.string().trim().min(1).max(2_000);
const taskText = z.string().trim().min(1).max(maxGraphNodeModuleStringLength);
const semver = z.string().regex(/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/);
const network = z.enum(["required", "forbidden", "optional"]);
const unique = <T>(values: T[]) => new Set(values).size === values.length;
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string().max(maxGraphNodeModuleStringLength), z.number().finite(), z.boolean(), z.null(),
  z.array(jsonValueSchema).max(256), z.record(z.string().max(200), jsonValueSchema)
]));
const body = z.string().min(1).max(maxGraphNodeModuleStringLength).refine(
  (value) => new TextEncoder().encode(value).byteLength <= maxGraphNodeModuleResourceBodyBytes
);
const appearance = { nodeStyle: z.enum(canvasNodeStyles), nodeSize: z.enum(canvasNodeSizes) };
const composition = {
  profileSlot: localKey,
  primaryInstruction: localKey,
  skills: z.array(localKey).max(maxGraphNodeModuleResources).refine(unique)
};
const executable = { ...appearance, key: localKey, description: shortText, task: taskText };
const workNode = z.discriminatedUnion("type", [
  z.object({ ...executable, ...composition, type: z.literal("agent") }).strict(),
  z.object({ ...executable, type: z.literal("human") }).strict()
]);
const validationNode = z.discriminatedUnion("type", [
  z.object({ ...executable, ...composition, type: z.literal("agent") }).strict(),
  z.object({ ...executable, type: z.literal("human") }).strict()
]);
const capabilities = z.object({
  accepts: z.array(nodeCapabilitySchema).max(64).refine(unique),
  provides: z.array(nodeCapabilitySchema).max(64).refine(unique)
}).strict();
const target = z.union([
  z.object({ jobNode: localKey }).strict(),
  z.object({ terminal: z.enum(["PASS", "FAIL"]) }).strict()
]);
const candidate = z.object({ target, description: shortText }).strict();
const routing = z.object({
  start: z.object({ key: localKey, candidates: z.array(candidate).min(1) }).strict(),
  continuation: z.array(z.object({
    key: localKey,
    sourceJobNode: localKey,
    result: z.enum(["PASS", "FAIL"]),
    candidates: z.array(candidate).min(1)
  }).strict()).max(maxGraphNodeModuleRules),
  repair: z.array(z.object({
    key: localKey,
    sourceJobNode: localKey,
    capability: nodeCapabilitySchema,
    candidates: z.array(candidate).min(1)
  }).strict()).max(maxGraphNodeModuleRules)
}).strict();
const orchestrator = z.object({
  ...appearance, ...composition, key: localKey, description: shortText,
  maxTransitions: z.number().int().min(1).max(256),
  maxRouteAttempts: z.number().int().min(1).max(3),
  routing
}).strict();
const repairNode = z.object({
  ...appearance, ...composition, key: localKey, description: shortText, task: taskText,
  maxRepairDepth: z.number().int().min(0).max(100),
  maxRepairAttempts: z.number().int().min(1).max(100)
}).strict();
const resource = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("instruction"), key: localKey, title: shortText, metadata: z.record(z.string(), jsonValueSchema), body }).strict(),
  z.object({ kind: z.literal("skill"), key: localKey, name: shortText, description: shortText, metadata: z.record(z.string(), jsonValueSchema), body }).strict()
]);

export const graphNodeModulePackageV4Schema = z.object({
  format: z.literal("ballet-graph-node-module"),
  version: z.literal(4),
  manifest: z.object({
    id: localKey, title: shortText, description: shortText, version: semver,
    category: localKey.optional(), tags: z.array(localKey).max(20).refine(unique)
  }).strict(),
  permissions: z.object({
    network,
    externalWrites: z.union([z.literal(false), z.literal("requires-human-authorization")])
  }).strict(),
  profileSlots: z.array(z.object({
    key: localKey, title: shortText, description: shortText,
    providers: z.array(z.enum(["codex", "copilot"])).min(1).max(2).refine(unique), network
  }).strict()).max(32),
  stateContract: z.object({
    id: localKey, version: semver, description: shortText,
    requiredKeys: z.array(stateKey).max(64).refine(unique)
  }).strict(),
  capabilities: z.object({
    requires: z.array(nodeCapabilitySchema).max(64).refine(unique),
    accepts: z.array(nodeCapabilitySchema).max(64).refine(unique),
    provides: z.array(nodeCapabilitySchema).max(64).refine(unique),
    recommendedGraphRoutes: z.array(z.object({
      direction: z.enum(["incoming", "outgoing"]), result: z.enum(["PASS", "FAIL"]),
      capability: nodeCapabilitySchema, description: shortText
    }).strict()).max(64)
  }).strict(),
  resources: z.array(resource).max(maxGraphNodeModuleResources),
  graphNode: z.object({
    ...appearance, key: localKey, description: shortText, capabilities,
    stateContract: z.object({ description: shortText }).strict(),
    orchestrator,
    repairNode: repairNode.optional(),
    jobNodes: z.array(z.object({
      ...appearance, key: localKey, description: shortText, capabilities,
      maxRetries: z.number().int().min(0).max(maxJobRetriesLimit), workNode, validationNode
    }).strict()).min(1).max(maxGraphNodeModuleNodes)
  }).strict()
}).strict().superRefine((pkg, context) => {
  const slots = new Set(pkg.profileSlots.map((slot) => slot.key));
  const resources = new Map(pkg.resources.map((entry) => [entry.key, entry]));
  const jobKeys = new Set(pkg.graphNode.jobNodes.map((job) => job.key));
  const ruleIds = [pkg.graphNode.orchestrator.routing.start.key,
    ...pkg.graphNode.orchestrator.routing.continuation.map((rule) => rule.key),
    ...pkg.graphNode.orchestrator.routing.repair.map((rule) => rule.key)];
  if (!unique(ruleIds)) context.addIssue({ code: "custom", path: ["graphNode", "orchestrator", "routing"], message: "Routing rule keys must be unique." });
  const compositions = [pkg.graphNode.orchestrator, ...(pkg.graphNode.repairNode ? [pkg.graphNode.repairNode] : []),
    ...pkg.graphNode.jobNodes.flatMap((job) => [job.workNode, job.validationNode]).filter((node) => node.type === "agent")];
  compositions.forEach((value, index) => {
    if (!slots.has(value.profileSlot)) context.addIssue({ code: "custom", path: ["compositions", index, "profileSlot"], message: "Unknown profile slot." });
    if (resources.get(value.primaryInstruction)?.kind !== "instruction") context.addIssue({ code: "custom", path: ["compositions", index, "primaryInstruction"], message: "Unknown instruction resource." });
    value.skills.forEach((skill) => {
      if (resources.get(skill)?.kind !== "skill") context.addIssue({ code: "custom", path: ["compositions", index, "skills"], message: `Unknown skill resource: ${skill}.` });
    });
  });
  const candidates = [
    ...pkg.graphNode.orchestrator.routing.start.candidates,
    ...pkg.graphNode.orchestrator.routing.continuation.flatMap((rule) => rule.candidates),
    ...pkg.graphNode.orchestrator.routing.repair.flatMap((rule) => rule.candidates)
  ];
  for (const jobKey of jobKeys) if (!candidates.some((value) => "jobNode" in value.target && value.target.jobNode === jobKey)) {
    context.addIssue({ code: "custom", path: ["graphNode", "orchestrator", "routing"], message: `Job Node ${jobKey} is unreachable.` });
  }
  for (const terminal of ["PASS", "FAIL"]) if (!candidates.some((value) => "terminal" in value.target && value.target.terminal === terminal)) {
    context.addIssue({ code: "custom", path: ["graphNode", "orchestrator", "routing"], message: `Terminal ${terminal} is unreachable.` });
  }
  pkg.graphNode.orchestrator.routing.continuation.forEach((rule, index) => {
    if (!jobKeys.has(rule.sourceJobNode)) context.addIssue({ code: "custom", path: ["graphNode", "orchestrator", "routing", "continuation", index], message: "Unknown source Job Node." });
  });
  pkg.graphNode.orchestrator.routing.repair.forEach((rule, index) => {
    if (!pkg.graphNode.repairNode) context.addIssue({ code: "custom", path: ["graphNode", "orchestrator", "routing", "repair", index], message: "Repair routing requires a Repair Node." });
    if (!jobKeys.has(rule.sourceJobNode)) context.addIssue({ code: "custom", path: ["graphNode", "orchestrator", "routing", "repair", index], message: "Unknown source Job Node." });
  });
}) as z.ZodType<GraphNodeModulePackageV4>;

export const graphNodeModuleInspectRequestSchema = z.object({ package: z.unknown(), source: z.string().trim().min(1).max(500).default("local-import") }).strict();
export const graphNodeModuleInstallPlanRequestSchema = z.object({
  package: z.unknown(), source: z.string().trim().min(1).max(500),
  profileMappings: z.record(localKey, z.string().min(1).max(200)).default({})
}).strict();
export const graphNodeModuleInstallCommitRequestSchema = graphNodeModuleInstallPlanRequestSchema.extend({ expectedPlanHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const graphNodeModuleExportRequestSchema = z.object({
  graphNodeId: localKey, title: shortText.optional(), description: shortText.optional(),
  version: semver.default("1.0.0"), category: localKey.optional(), tags: z.array(localKey).max(20).default([])
}).strict();
export const graphNodeModuleParamsSchema = z.object({ graphNodeId: localKey }).strict();
