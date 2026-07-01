import { z } from "zod";

export const mutableCollections = ["projects", "goals", "adrs", "agents", "skills"] as const;
export const readableCollections = [...mutableCollections, "runtimes", "policies", "events"] as const;

const stringRecordSchema = z.record(z.string(), z.string());
const unknownRecordSchema = z.record(z.string(), z.unknown());

const markdownBackedFields = {
  frontmatter: unknownRecordSchema.optional(),
  body: z.string().optional(),
  relativePath: z.string().optional(),
  slug: z.string().optional(),
  errors: z.array(z.string()).optional()
};

const skillSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  metadata: stringRecordSchema.optional(),
  enabled: z.boolean().optional(),
  ...markdownBackedFields
}).strict();

export const projectDocumentSaveSchema = z.object({
  relativePath: z.string().min(1),
  frontmatter: unknownRecordSchema,
  body: z.string()
}).strict();

export const projectDocumentCreateSchema = z.object({
  directoryPath: z.string().min(1),
  title: z.string().min(1)
}).strict();

export const collectionParamsSchema = z.object({
  collection: z.string().min(1)
}).strict();

export const mutableCollectionParamsSchema = z.object({
  collection: z.string().min(1)
}).strict();

export const collectionItemParamsSchema = z.object({
  collection: z.string().min(1),
  id: z.string().min(1)
}).strict();

const projectUpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["active", "paused", "archived"]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  ...markdownBackedFields
}).strict();

const goalUpsertSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["not-started", "in-progress", "at-risk", "done"]).optional(),
  targetDate: z.string().optional(),
  owner: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  ...markdownBackedFields
}).strict();

const adrUpsertSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().optional(),
  title: z.string().optional(),
  context: z.string().optional(),
  decision: z.string().optional(),
  consequences: z.string().optional(),
  status: z.enum(["proposed", "accepted", "superseded", "rejected"]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  ...markdownBackedFields
}).strict();

const agentUpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  skills: z.array(skillSchema).optional(),
  enabled: z.boolean().optional(),
  status: z.enum(["online", "offline"]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  model: z.string().optional(),
  modelReasoningEffort: z.string().optional(),
  nicknameCandidates: z.array(z.string()).optional(),
  ...markdownBackedFields
}).strict();

const collectionUpsertSchemas = {
  projects: projectUpsertSchema,
  goals: goalUpsertSchema,
  adrs: adrUpsertSchema,
  agents: agentUpsertSchema,
  skills: skillSchema
} as const;

export type MutableCollectionName = keyof typeof collectionUpsertSchemas;

export const collectionUpsertSchema = (collection: MutableCollectionName) =>
  collectionUpsertSchemas[collection];
