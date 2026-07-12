import { z } from "zod";
import { agentAvatars } from "../domain/agents.js";
import {
  loopNodeSizes,
  type ProjectAutomationConfig,
  type ProjectStepSchedule
} from "../domain/automation.js";
import {
  loopConnectionPointStyles,
  loopEdgeLineStyles,
  loopNodeRenderers,
  type LoopTheme
} from "../domain/loopThemes.js";
import {
  automationFieldLimits,
  kebabCaseIdPattern
} from "./automationValidation.js";
import type { WorkspaceSaveRequestByCollection } from "./workspace-contracts.js";

export const mutableCollections = ["projects", "goals", "adrs", "agents", "skills"] as const;
export const readableCollections = [...mutableCollections, "policies", "events"] as const;

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
  avatar: z.enum(agentAvatars)
    .nullable()
    .optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
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

export const collectionUpsertSchema = <T extends MutableCollectionName>(
  collection: T
): z.ZodType<WorkspaceSaveRequestByCollection[T]> =>
  collectionUpsertSchemas[collection] as unknown as z.ZodType<WorkspaceSaveRequestByCollection[T]>;

const optionalAutomationDescriptionSchema = z.string().max(automationFieldLimits.description.max);
const automationLoopIdSchema = z.string().min(automationFieldLimits.loopId.min).max(automationFieldLimits.loopId.max);
const automationStepIdSchema = z.string()
  .min(automationFieldLimits.stepId.min)
  .max(automationFieldLimits.stepId.max)
  .regex(kebabCaseIdPattern, "Step id must be lowercase kebab-case.");
const kebabLoopIdSchema = automationLoopIdSchema.regex(kebabCaseIdPattern, "Loop id must be lowercase kebab-case.");
export const loopThemeIdSchema = z.string()
  .min(1)
  .max(64)
  .regex(kebabCaseIdPattern, "Theme id must be lowercase kebab-case.");
const loopThemeColorSchema = z.string()
  .regex(/^#[0-9a-f]{6}$/, "Expected a six-digit lowercase hex color.");
const loopThemeStylesSchema = z.object({
  small: z.enum(loopNodeRenderers),
  medium: z.enum(loopNodeRenderers),
  large: z.enum(loopNodeRenderers)
}).strict();

export const loopThemeSchema = z.object({
  version: z.literal(1),
  id: loopThemeIdSchema,
  label: z.string().trim().min(1),
  node: z.object({
    labelColor: loopThemeColorSchema,
    glowColor: loopThemeColorSchema,
    styles: loopThemeStylesSchema,
    showAgentAvatarInNode: z.boolean()
  }).strict(),
  edge: z.object({
    color: loopThemeColorSchema,
    labelColor: loopThemeColorSchema,
    style: z.enum(loopEdgeLineStyles),
    rejectedStyle: z.enum(loopEdgeLineStyles),
    crossLoopStyle: z.enum(loopEdgeLineStyles)
  }).strict(),
  connectionPoint: z.object({
    style: z.enum(loopConnectionPointStyles),
    color: loopThemeColorSchema
  }).strict()
}).strict() satisfies z.ZodType<LoopTheme>;

export const loopThemeParamsSchema = z.object({
  themeId: loopThemeIdSchema
}).strict();

export const createLoopThemeSchema = z.object({
  theme: loopThemeSchema,
  assignToLoopId: kebabLoopIdSchema
}).strict();
const stepEndSchema = z.object({ end: z.enum(["completed", "blocked", "failed"]) }).strict();
const stepLoopSchema = z.object({ loop: kebabLoopIdSchema }).strict();
const stepTransitionTargetSchema = z.union([automationStepIdSchema, stepLoopSchema, stepEndSchema]);
const stepTransitionsSchema = z.object({
  approved: stepTransitionTargetSchema,
  rejected: stepTransitionTargetSchema
}).strict();
const executableStepBase = {
  id: automationStepIdSchema,
  description: optionalAutomationDescriptionSchema,
  nodeSize: z.enum(loopNodeSizes),
  on: stepTransitionsSchema
};
const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const clockTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const isCalendarDate = (value: string): boolean => {
  if (!calendarDatePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const isTimeZone = (value: string): boolean => {
  if (/^[+-]\d{2}:\d{2}$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
};
const calendarDateSchema = z.string().refine(isCalendarDate, "Expected a valid date in YYYY-MM-DD format.");
const clockTimeSchema = z.string().regex(clockTimePattern, "Expected a valid time in HH:mm format.");
const timeZoneSchema = z.string().min(1).refine(isTimeZone, "Expected a valid IANA time zone.");
const scheduleBase = {
  time: clockTimeSchema,
  timeZone: timeZoneSchema
};
const recurringScheduleBase = {
  ...scheduleBase,
  kind: z.literal("recurring"),
  startsOn: calendarDateSchema
};
const scheduleWeekdaySchema = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const recurringScheduleSchema = z.discriminatedUnion("cadence", [
  z.object({ ...recurringScheduleBase, cadence: z.literal("daily") }).strict(),
  z.object({ ...recurringScheduleBase, cadence: z.literal("weekdays") }).strict(),
  z.object({
    ...recurringScheduleBase,
    cadence: z.literal("weekly"),
    weekdays: z.array(scheduleWeekdaySchema)
      .min(1)
      .refine((days) => new Set(days).size === days.length, "Weekdays must be unique.")
  }).strict(),
  z.object({
    ...recurringScheduleBase,
    cadence: z.literal("monthly"),
    dayOfMonth: z.number().int().min(1).max(31)
  }).strict()
]);
export const projectStepScheduleSchema = z.union([
  z.object({
    ...scheduleBase,
    kind: z.literal("once"),
    date: calendarDateSchema
  }).strict(),
  recurringScheduleSchema
]) satisfies z.ZodType<ProjectStepSchedule>;
const projectStepSchema = z.discriminatedUnion("type", [
  z.object({ ...executableStepBase, type: z.literal("agent"), agentId: z.string().min(1) }).strict(),
  z.object({ ...executableStepBase, type: z.literal("human") }).strict(),
  z.object({
    id: automationStepIdSchema,
    description: optionalAutomationDescriptionSchema,
    nodeSize: z.enum(loopNodeSizes),
    type: z.literal("scheduled"),
    schedule: projectStepScheduleSchema,
    on: z.object({ triggered: automationStepIdSchema }).strict()
  }).strict()
]);

const projectLoopSchema = z.object({
  id: kebabLoopIdSchema,
  theme: loopThemeIdSchema,
  start: automationStepIdSchema,
  steps: z.array(projectStepSchema).min(1)
}).strict();

export const automationConfigSchema = z.object({
  version: z.literal(5),
  loops: z.array(projectLoopSchema)
}).strict() satisfies z.ZodType<ProjectAutomationConfig>;

export const eventIntakeSchema = z.object({
  projectId: z.string().min(1),
  eventType: z.string().min(1),
  source: z.string().optional(),
  subject: z.string().optional(),
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
  dedupeKey: z.string().optional(),
  correlationDepth: z.number().int().nonnegative().optional(),
  tags: z.array(z.string()).optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  body: z.string().optional()
}).strict();

export const eventParamsSchema = z.object({
  id: z.string().min(1)
}).strict();

export const loopParamsSchema = z.object({
  loopId: kebabLoopIdSchema
}).strict();

export const loopRunParamsSchema = z.object({
  runId: z.string().uuid()
}).strict();

export const stepRunParamsSchema = z.object({
  runId: z.string().uuid(),
  stepRunId: z.string().uuid()
}).strict();

export const startLoopRunSchema = z.object({
  input: z.string().max(20000).optional()
}).strict();

export const respondToStepRunSchema = z.object({
  result: z.enum(["approved", "rejected"]),
  input: z.string().trim().min(1).max(20000)
}).strict();

export const agentRunParamsSchema = z.object({
  id: z.string().min(1)
}).strict();
