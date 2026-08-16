import { z } from "zod";
import {
  loopNodeSizes,
  loopNodeStyles,
  loopTerminals,
  maxLocalAttemptsLimit,
  maxProjectStateBytes,
  type JsonValue
} from "../domain/automation.js";
import {
  maxLoopModuleEdges,
  maxLoopModuleNodes,
  maxLoopModuleResourceBodyBytes,
  maxLoopModuleResources,
  maxLoopModuleStringLength,
  type LoopModulePackageV1
} from "../domain/loopModules.js";
import { projectWorkScheduleSchema } from "./work-schedule-schema.js";

const localKey = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a lowercase kebab-case module-local key.");
const stateKey = z.string().min(1).max(100).regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "Expected a bounded top-level State key.");
const capability = z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:[.:/-][a-z0-9]+)*$/, "Expected a stable lowercase capability id.");
const shortText = z.string().trim().min(1).max(2_000);
const taskText = z.string().trim().min(1).max(maxLoopModuleStringLength);
const semver = z.string().regex(/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/, "Expected semantic version x.y.z.");
const networkRequirement = z.enum(["required", "forbidden", "optional"]);
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string().max(maxLoopModuleStringLength),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(jsonValueSchema).max(256),
  z.record(z.string().max(200), jsonValueSchema)
]));
const jsonObjectSchema = z.record(z.string().max(200), jsonValueSchema);
const unique = <T>(items: T[]): boolean => new Set(items).size === items.length;
const body = z.string().min(1).max(maxLoopModuleStringLength).refine(
  (value) => new TextEncoder().encode(value).byteLength <= maxLoopModuleResourceBodyBytes,
  `Resource body must not exceed ${maxLoopModuleResourceBodyBytes} UTF-8 bytes.`
);

const composition = {
  profileSlot: localKey,
  primaryInstruction: localKey,
  skills: z.array(localKey).max(maxLoopModuleResources).refine(unique, "Skill keys must be unique.")
};
const appearance = { nodeStyle: z.enum(loopNodeStyles), nodeSize: z.enum(loopNodeSizes), task: taskText };
const workSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("agent"), ...appearance, ...composition }).strict(),
  z.object({ type: z.literal("human"), ...appearance }).strict(),
  z.object({ type: z.literal("scheduled"), ...appearance, ...composition, schedule: projectWorkScheduleSchema }).strict()
]);
const validationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("agent"), ...appearance, ...composition }).strict(),
  z.object({ type: z.literal("human"), ...appearance }).strict()
]);
const moduleNodeSchema = z.object({
  key: localKey,
  description: shortText,
  work: workSchema,
  validation: validationSchema,
  maxLocalAttempts: z.number().int().min(1).max(maxLocalAttemptsLimit)
}).strict();
const moduleEdgeSchema = z.object({
  key: localKey,
  source: localKey,
  target: z.union([
    z.object({ node: localKey }).strict(),
    z.object({ terminal: z.enum(loopTerminals) }).strict()
  ])
}).strict();
const instructionResourceSchema = z.object({
  kind: z.literal("instruction"),
  key: localKey,
  title: shortText,
  metadata: jsonObjectSchema,
  body
}).strict();
const skillResourceSchema = z.object({
  kind: z.literal("skill"),
  key: localKey,
  name: shortText,
  description: shortText,
  metadata: jsonObjectSchema,
  body
}).strict();

export const loopModulePackageV1Schema = z.object({
  format: z.literal("ballet-loop-module"),
  version: z.literal(1),
  manifest: z.object({
    id: localKey,
    title: shortText,
    description: shortText,
    version: semver,
    category: z.string().trim().min(1).max(100).optional(),
    tags: z.array(localKey).max(20).refine(unique, "Tags must be unique.")
  }).strict(),
  permissions: z.object({ network: networkRequirement, externalWrites: z.literal(false) }).strict(),
  profileSlots: z.array(z.object({
    key: localKey,
    title: shortText,
    description: shortText,
    providers: z.array(z.enum(["codex", "copilot"])).min(1).max(2).refine(unique, "Providers must be unique."),
    network: networkRequirement
  }).strict()).max(32),
  stateContract: z.object({
    id: localKey,
    version: semver,
    description: shortText,
    initial: jsonValueSchema,
    requiredKeys: z.array(stateKey).max(64).refine(unique, "Required State keys must be unique.")
  }).strict(),
  capabilities: z.object({
    requires: z.array(capability).max(64).refine(unique, "Required capabilities must be unique."),
    provides: z.array(capability).max(64).refine(unique, "Provided capabilities must be unique."),
    recommendedConnections: z.array(z.object({
      kind: z.enum(["flow", "repair"]),
      direction: z.enum(["incoming", "outgoing"]),
      capability,
      description: shortText
    }).strict()).max(64)
  }).strict(),
  resources: z.array(z.discriminatedUnion("kind", [instructionResourceSchema, skillResourceSchema])).max(maxLoopModuleResources),
  loop: z.object({
    key: localKey,
    description: shortText,
    state: z.object({
      description: shortText,
      initial: jsonValueSchema.refine((value) => new TextEncoder().encode(JSON.stringify(value)).byteLength <= maxProjectStateBytes)
    }).strict(),
    startNode: localKey,
    nodes: z.array(moduleNodeSchema).min(1).max(maxLoopModuleNodes),
    edges: z.array(moduleEdgeSchema).max(maxLoopModuleEdges)
  }).strict()
}).strict().superRefine((pkg, context) => {
  const resourceKeys = pkg.resources.map((resource) => resource.key);
  const slotKeys = pkg.profileSlots.map((slot) => slot.key);
  const nodeKeys = pkg.loop.nodes.map((node) => node.key);
  const edgeKeys = pkg.loop.edges.map((edge) => edge.key);
  for (const [path, values] of [
    [["resources"], resourceKeys], [["profileSlots"], slotKeys], [["loop", "nodes"], nodeKeys], [["loop", "edges"], edgeKeys]
  ] as const) if (!unique(values)) context.addIssue({ code: "custom", path: [...path], message: "Module-local keys must be unique." });
  const resources = new Map(pkg.resources.map((resource) => [resource.key, resource]));
  const slots = new Set(slotKeys);
  const nodes = new Set(nodeKeys);
  if (!nodes.has(pkg.loop.startNode)) context.addIssue({ code: "custom", path: ["loop", "startNode"], message: "Start node must reference a module node." });
  pkg.loop.nodes.forEach((node, index) => {
    for (const [partName, part] of [["work", node.work], ["validation", node.validation]] as const) {
      if (part.type === "human") continue;
      if (!slots.has(part.profileSlot)) context.addIssue({ code: "custom", path: ["loop", "nodes", index, partName, "profileSlot"], message: "Unknown profile slot." });
      if (resources.get(part.primaryInstruction)?.kind !== "instruction") context.addIssue({ code: "custom", path: ["loop", "nodes", index, partName, "primaryInstruction"], message: "Primary instruction must reference an instruction resource." });
      part.skills.forEach((key, skillIndex) => {
        if (resources.get(key)?.kind !== "skill") context.addIssue({ code: "custom", path: ["loop", "nodes", index, partName, "skills", skillIndex], message: "Skill must reference a skill resource." });
      });
    }
    if (node.work.type === "scheduled" && node.key !== pkg.loop.startNode) context.addIssue({ code: "custom", path: ["loop", "nodes", index, "work", "type"], message: "Scheduled Work is allowed only on the start node." });
  });
  pkg.loop.edges.forEach((edge, index) => {
    if (!nodes.has(edge.source)) context.addIssue({ code: "custom", path: ["loop", "edges", index, "source"], message: "Edge source must reference a module node." });
    if ("node" in edge.target && !nodes.has(edge.target.node)) context.addIssue({ code: "custom", path: ["loop", "edges", index, "target", "node"], message: "Edge target must reference a module node." });
  });
  for (const node of pkg.loop.nodes) if (pkg.loop.edges.filter((edge) => edge.source === node.key).length !== 1) context.addIssue({ code: "custom", path: ["loop", "edges"], message: `Node ${node.key} must have exactly one outgoing edge.` });
  if (JSON.stringify(pkg.loop.state.initial) !== JSON.stringify(pkg.stateContract.initial)) context.addIssue({ code: "custom", path: ["stateContract", "initial"], message: "State contract initial value must equal Loop state initial value." });
  if (pkg.stateContract.requiredKeys.length > 0) {
    const initial = pkg.stateContract.initial;
    if (!initial || typeof initial !== "object" || Array.isArray(initial)) {
      context.addIssue({ code: "custom", path: ["stateContract", "requiredKeys"], message: "Required State keys need an object-valued initial State." });
    } else {
      pkg.stateContract.requiredKeys.forEach((key, index) => {
        if (!Object.hasOwn(initial, key)) context.addIssue({ code: "custom", path: ["stateContract", "requiredKeys", index], message: `Required State key ${key} is missing from the initial State.` });
      });
    }
  }
  const slotNetwork = new Set(pkg.profileSlots.map((slot) => slot.network));
  if (pkg.permissions.network === "required" && slotNetwork.has("forbidden")) context.addIssue({ code: "custom", path: ["permissions", "network"], message: "Package network summary conflicts with a forbidden profile slot." });
  if (pkg.permissions.network === "forbidden" && slotNetwork.has("required")) context.addIssue({ code: "custom", path: ["permissions", "network"], message: "Package network summary conflicts with a required profile slot." });
}) satisfies z.ZodType<LoopModulePackageV1>;

export const loopModuleInspectRequestSchema = z.object({
  package: z.unknown(),
  source: z.string().trim().min(1).max(500).default("local-import")
}).strict();
export const loopModuleInstallPlanRequestSchema = z.object({
  package: z.unknown(),
  source: z.string().trim().min(1).max(500),
  profileMappings: z.record(localKey, z.string().min(1).max(200)).default({})
}).strict();
export const loopModuleInstallCommitRequestSchema = loopModuleInstallPlanRequestSchema.extend({
  expectedPlanHash: z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
export const loopModuleExportRequestSchema = z.object({
  loopId: localKey,
  title: z.string().trim().min(1).max(2_000).optional(),
  description: z.string().trim().min(1).max(2_000).optional(),
  version: semver.default("1.0.0"),
  category: localKey.optional(),
  tags: z.array(localKey).max(20).default([])
}).strict();
export const loopModuleLoopParamsSchema = z.object({ loopId: localKey }).strict();
