import { z } from "zod";
import {
  loopNodeSizes,
  loopNodeStyles,
  maxJobRetriesLimit,
  maxProjectStateBytes,
  type JsonValue
} from "../domain/automation.js";
import {
  maxLoopModuleEdges,
  maxLoopModuleNodes,
  maxLoopModuleResourceBodyBytes,
  maxLoopModuleResources,
  maxLoopModuleStringLength,
  type LoopModulePackageV3
} from "../domain/loopModules.js";
import { projectJobScheduleSchema } from "./job-schedule-schema.js";
import { loopCapabilitySchema } from "./workspace-schemas.js";

const localKey = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a lowercase kebab-case module-local key.");
const stateKey = z.string().min(1).max(100).regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "Expected a bounded top-level State key.");
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
const canonicalJson = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalJson(entry)])
    );
  }
  return value;
};
const jsonValuesEqual = (left: JsonValue, right: JsonValue): boolean =>
  JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
const body = z.string().min(1).max(maxLoopModuleStringLength).refine(
  (value) => new TextEncoder().encode(value).byteLength <= maxLoopModuleResourceBodyBytes,
  `Resource body must not exceed ${maxLoopModuleResourceBodyBytes} UTF-8 bytes.`
);

const composition = {
  profileSlot: localKey,
  primaryInstruction: localKey,
  skills: z.array(localKey).max(maxLoopModuleResources).refine(unique, "Skill keys must be unique.")
};
const nodeBase = {
  key: localKey,
  description: shortText,
  nodeStyle: z.enum(loopNodeStyles),
  nodeSize: z.enum(loopNodeSizes),
  task: taskText
};
const jobFields = {
  ...nodeBase,
  validationNode: localKey,
  maxRetries: z.number().int().min(0).max(maxJobRetriesLimit)
};
const jobSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("agent"), ...jobFields, ...composition }).strict(),
  z.object({ type: z.literal("human"), ...jobFields }).strict(),
  z.object({ type: z.literal("scheduled"), ...jobFields, ...composition, schedule: projectJobScheduleSchema }).strict()
]);
const validationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("agent"), ...nodeBase, ...composition }).strict(),
  z.object({ type: z.literal("human"), ...nodeBase }).strict()
]);
const passEdgeSchema = z.object({
  key: localKey,
  sourceValidationNode: localKey,
  target: z.union([
    z.object({ jobNode: localKey }).strict(),
    z.object({ workflowResult: z.literal("PASS") }).strict()
  ])
}).strict();
const failEdgeSchema = z.object({
  key: localKey,
  sourceValidationNode: localKey,
  target: z.object({ workflowResult: z.literal("FAIL") }).strict()
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

export const loopModulePackageV3Schema = z.object({
  format: z.literal("ballet-loop-module"),
  version: z.literal(3),
  manifest: z.object({
    id: localKey,
    title: shortText,
    description: shortText,
    version: semver,
    category: z.string().trim().min(1).max(100).optional(),
    tags: z.array(localKey).max(20).refine(unique, "Tags must be unique.")
  }).strict(),
  permissions: z.object({
    network: networkRequirement,
    externalWrites: z.union([z.literal(false), z.literal("requires-human-authorization")])
  }).strict(),
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
    requires: z.array(loopCapabilitySchema).max(64).refine(unique, "Required capabilities must be unique."),
    accepts: z.array(loopCapabilitySchema).max(64).refine(unique, "Accepted capabilities must be unique."),
    provides: z.array(loopCapabilitySchema).max(64).refine(unique, "Provided capabilities must be unique."),
    recommendedTransitions: z.array(z.object({
      direction: z.enum(["incoming", "outgoing"]),
      decision: z.enum(["PASS", "FAIL"]),
      outcome: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
      capability: loopCapabilitySchema,
      description: shortText
    }).strict()).max(64),
    recommendedRepairs: z.array(z.object({
      direction: z.enum(["incoming", "outgoing"]),
      capability: loopCapabilitySchema,
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
    workflow: z.object({
      startJobNode: localKey,
      jobNodes: z.array(jobSchema).min(1).max(maxLoopModuleNodes),
      validationNodes: z.array(validationSchema).min(1).max(maxLoopModuleNodes),
      passEdges: z.array(passEdgeSchema).max(maxLoopModuleEdges),
      failEdges: z.array(failEdgeSchema).max(maxLoopModuleEdges)
    }).strict()
  }).strict()
}).strict().superRefine((pkg, context) => {
  const resourceKeys = pkg.resources.map((resource) => resource.key);
  const slotKeys = pkg.profileSlots.map((slot) => slot.key);
  const jobKeys = pkg.loop.workflow.jobNodes.map((node) => node.key);
  const validationKeys = pkg.loop.workflow.validationNodes.map((node) => node.key);
  const nodeKeys = [...jobKeys, ...validationKeys];
  const edgeKeys = [...pkg.loop.workflow.passEdges, ...pkg.loop.workflow.failEdges].map((edge) => edge.key);
  for (const [path, values] of [
    [["resources"], resourceKeys], [["profileSlots"], slotKeys], [["loop", "workflow", "nodes"], nodeKeys], [["loop", "workflow", "edges"], edgeKeys]
  ] as const) if (!unique(values)) context.addIssue({ code: "custom", path: [...path], message: "Module-local keys must be unique." });
  const resources = new Map(pkg.resources.map((resource) => [resource.key, resource]));
  const slots = new Set(slotKeys);
  const jobs = new Set(jobKeys);
  const validations = new Set(validationKeys);
  if (!jobs.has(pkg.loop.workflow.startJobNode)) context.addIssue({ code: "custom", path: ["loop", "workflow", "startJobNode"], message: "Start JobNode must reference a module JobNode." });
  const ownedValidations = new Set<string>();
  for (const [kind, nodes] of [["jobNodes", pkg.loop.workflow.jobNodes], ["validationNodes", pkg.loop.workflow.validationNodes]] as const) {
    nodes.forEach((node, index) => {
      if (node.type !== "human") {
        if (!slots.has(node.profileSlot)) context.addIssue({ code: "custom", path: ["loop", "workflow", kind, index, "profileSlot"], message: "Unknown profile slot." });
        if (resources.get(node.primaryInstruction)?.kind !== "instruction") context.addIssue({ code: "custom", path: ["loop", "workflow", kind, index, "primaryInstruction"], message: "Primary instruction must reference an instruction resource." });
        node.skills.forEach((key, skillIndex) => {
          if (resources.get(key)?.kind !== "skill") context.addIssue({ code: "custom", path: ["loop", "workflow", kind, index, "skills", skillIndex], message: "Skill must reference a skill resource." });
        });
      }
      if (kind === "jobNodes") {
        const job = node as (typeof pkg.loop.workflow.jobNodes)[number];
        if (!validations.has(job.validationNode)) context.addIssue({ code: "custom", path: ["loop", "workflow", kind, index, "validationNode"], message: "JobNode must reference a ValidationNode." });
        if (ownedValidations.has(job.validationNode)) context.addIssue({ code: "custom", path: ["loop", "workflow", kind, index, "validationNode"], message: "ValidationNode may be owned by only one JobNode." });
        ownedValidations.add(job.validationNode);
        if (job.type === "scheduled" && job.key !== pkg.loop.workflow.startJobNode) context.addIssue({ code: "custom", path: ["loop", "workflow", kind, index, "type"], message: "Scheduled Job is allowed only on the start JobNode." });
      }
    });
  }
  pkg.loop.workflow.validationNodes.forEach((node, index) => {
    if (!ownedValidations.has(node.key)) context.addIssue({ code: "custom", path: ["loop", "workflow", "validationNodes", index, "key"], message: "ValidationNode must be owned by one JobNode." });
    if (pkg.loop.workflow.passEdges.filter((edge) => edge.sourceValidationNode === node.key).length !== 1) context.addIssue({ code: "custom", path: ["loop", "workflow", "passEdges"], message: `ValidationNode ${node.key} must have exactly one PassEdge.` });
    if (pkg.loop.workflow.failEdges.filter((edge) => edge.sourceValidationNode === node.key).length !== 1) context.addIssue({ code: "custom", path: ["loop", "workflow", "failEdges"], message: `ValidationNode ${node.key} must have exactly one FailEdge.` });
  });
  pkg.loop.workflow.passEdges.forEach((edge, index) => {
    if (!validations.has(edge.sourceValidationNode)) context.addIssue({ code: "custom", path: ["loop", "workflow", "passEdges", index, "sourceValidationNode"], message: "PassEdge source must reference a ValidationNode." });
    if ("jobNode" in edge.target && !jobs.has(edge.target.jobNode)) context.addIssue({ code: "custom", path: ["loop", "workflow", "passEdges", index, "target", "jobNode"], message: "PassEdge target must reference a JobNode." });
  });
  pkg.loop.workflow.failEdges.forEach((edge, index) => {
    if (!validations.has(edge.sourceValidationNode)) context.addIssue({ code: "custom", path: ["loop", "workflow", "failEdges", index, "sourceValidationNode"], message: "FailEdge source must reference a ValidationNode." });
  });
  if (!jsonValuesEqual(pkg.loop.state.initial, pkg.stateContract.initial)) context.addIssue({ code: "custom", path: ["stateContract", "initial"], message: "State contract initial value must equal Loop state initial value." });
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
}) satisfies z.ZodType<LoopModulePackageV3>;

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
