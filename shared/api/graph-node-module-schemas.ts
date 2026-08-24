import { z } from "zod";
import { canvasNodeSizes, canvasNodeStyles, maxActionRetriesLimit, type JsonValue } from "../domain/automation.js";
import {
  maxGraphNodeModuleNodes,
  maxGraphNodeModuleResourceBodyBytes,
  maxGraphNodeModuleResources,
  maxGraphNodeModuleStringLength,
  type GraphNodeModulePackageV7
} from "../domain/graphNodeModules.js";
import { nodeCapabilitySchema } from "./workspace-schemas.js";
import { rewardDecisionStrategySchema } from "./decision-model-schemas.js";

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
  profileSlot: localKey, primaryInstruction: localKey,
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
const outcomes = z.array(z.object({ outcomeId: localKey, result: z.enum(["PASS", "FAIL"]) }).strict())
  .min(1).max(64).refine((values) => unique(values.map(({ outcomeId }) => outcomeId)), "Outcome ids must be unique.");
const resource = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("instruction"), key: localKey, title: shortText,
    metadata: z.record(z.string(), jsonValueSchema), body
  }).strict(),
  z.object({
    kind: z.literal("skill"), key: localKey, name: shortText, description: shortText,
    metadata: z.record(z.string(), jsonValueSchema), body
  }).strict()
]);

export const graphNodeModulePackageV7Schema = z.object({
  format: z.literal("ballet-graph-node-module"), version: z.literal(7),
  manifest: z.object({
    id: localKey, title: shortText, description: shortText, version: semver,
    category: localKey.optional(), tags: z.array(localKey).max(20).refine(unique)
  }).strict(),
  permissions: z.object({
    network, externalWrites: z.union([z.literal(false), z.literal("requires-human-authorization")])
  }).strict(),
  profileSlots: z.array(z.object({
    key: localKey, title: shortText, description: shortText,
    providers: z.array(z.enum(["codex", "copilot"])).min(1).max(2).refine(unique), network
  }).strict()).max(32),
  stateContract: z.object({
    id: localKey, version: semver, description: shortText, requiredKeys: z.array(stateKey).max(64).refine(unique)
  }).strict(),
  capabilities: z.object({
    requires: z.array(nodeCapabilitySchema).max(64).refine(unique),
    accepts: z.array(nodeCapabilitySchema).max(64).refine(unique),
    provides: z.array(nodeCapabilitySchema).max(64).refine(unique)
  }).strict(),
  resources: z.array(resource).max(maxGraphNodeModuleResources),
  graphNode: z.object({
    key: localKey, description: shortText, capabilities, outcomes,
    stateContract: z.object({ description: shortText }).strict(),
    strategy: rewardDecisionStrategySchema,
    actionNodes: z.array(z.object({
      key: localKey, description: shortText, capabilities, outcomes,
      maxRetries: z.number().int().min(0).max(maxActionRetriesLimit), workNode, validationNode
    }).strict()).min(1).max(maxGraphNodeModuleNodes)
  }).strict()
}).strict().superRefine((pkg, context) => {
  const slots = new Set(pkg.profileSlots.map((slot) => slot.key));
  const resources = new Map(pkg.resources.map((entry) => [entry.key, entry]));
  const compositions = pkg.graphNode.actionNodes.flatMap((action) => [action.workNode, action.validationNode])
    .filter((node) => node.type === "agent");
  compositions.forEach((value, index) => {
    if (!slots.has(value.profileSlot)) context.addIssue({
      code: "custom", path: ["compositions", index, "profileSlot"], message: "Unknown profile slot."
    });
    if (resources.get(value.primaryInstruction)?.kind !== "instruction") context.addIssue({
      code: "custom", path: ["compositions", index, "primaryInstruction"], message: "Unknown instruction resource."
    });
    value.skills.forEach((skill) => {
      if (resources.get(skill)?.kind !== "skill") context.addIssue({
        code: "custom", path: ["compositions", index, "skills"], message: `Unknown skill resource: ${skill}.`
      });
    });
  });
  const actionKeys = new Set(pkg.graphNode.actionNodes.map(({ key }) => key));
  if (!actionKeys.has(pkg.graphNode.strategy.model.initialStateId)) context.addIssue({
    code: "custom", path: ["graphNode", "strategy", "model", "initialStateId"],
    message: "Local policy initial state must be an Action Node key."
  });
  pkg.graphNode.strategy.model.stateActions.forEach((row, index) => {
    if (!actionKeys.has(row.stateId) || !actionKeys.has(row.actionId)) context.addIssue({
      code: "custom", path: ["graphNode", "strategy", "model", "stateActions", index],
      message: "Local policy state/action ids must be Action Node keys."
    });
    row.successors.forEach((branch, branchIndex) => {
      if (branch.target.kind === "state" && !actionKeys.has(branch.target.stateId)) context.addIssue({
        code: "custom", path: ["graphNode", "strategy", "model", "stateActions", index, "successors", branchIndex, "target"],
        message: "Local policy target state must be an Action Node key."
      });
    });
  });
}) as z.ZodType<GraphNodeModulePackageV7>;

export const graphNodeModuleInspectRequestSchema = z.object({
  package: z.unknown(), source: z.string().trim().min(1).max(500).default("local-import")
}).strict();
export const graphNodeModuleInstallPlanRequestSchema = z.object({
  package: z.unknown(), source: z.string().trim().min(1).max(500),
  profileMappings: z.record(localKey, z.string().min(1).max(200)).default({})
}).strict();
export const graphNodeModuleInstallCommitRequestSchema = graphNodeModuleInstallPlanRequestSchema.extend({
  expectedPlanHash: z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
export const graphNodeModuleExportRequestSchema = z.object({
  graphNodeId: localKey, title: shortText.optional(), description: shortText.optional(),
  version: semver.default("1.0.0"), category: localKey.optional(), tags: z.array(localKey).max(20).default([])
}).strict();
export const graphNodeModuleParamsSchema = z.object({ graphNodeId: localKey }).strict();
