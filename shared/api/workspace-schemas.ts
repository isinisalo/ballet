import { z } from "zod";
import { agentAvatars } from "../domain/agents.js";
import {
  clockTimePattern,
  isCalendarDate,
  isIanaTimeZone,
  loopNodeStyles,
  type ProjectAutomationConfig,
  type ProjectStepSchedule
} from "../domain/automation.js";
import type { ProjectConfiguration } from "../domain/projectConfig.js";
import { portableAgentRuntimeIntentSchema } from "./runtime-schemas.js";
import {
  loopConnectionPointStyles,
  loopEdgeLineStyles,
  type LoopTheme
} from "../domain/loopThemes.js";
import type { WorkspaceSaveRequestByCollection } from "./workspace-contracts.js";

const stringRecordSchema = z.record(z.string(), z.string());
const unknownRecordSchema = z.record(z.string(), z.unknown());

const editableMarkdownFields = {
  frontmatter: unknownRecordSchema.optional(),
  body: z.string().optional()
};

const serverManagedFields = {
  relativePath: z.unknown().optional(),
  slug: z.unknown().optional(),
  errors: z.unknown().optional()
};

const omitServerManagedFields = <T extends Record<string, unknown>>(value: T) => {
  const result = { ...value };
  for (const key of ["relativePath", "slug", "errors", "createdAt", "updatedAt"]) delete result[key];
  return result;
};

const skillSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  metadata: stringRecordSchema.optional(),
  enabled: z.boolean().optional(),
  ...editableMarkdownFields,
  ...serverManagedFields
}).strict().transform(omitServerManagedFields);

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

export const collectionItemParamsSchema = z.object({
  collection: z.string().min(1),
  id: z.string().min(1)
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
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
  nicknameCandidates: z.array(z.string()).optional(),
  ...editableMarkdownFields,
  ...serverManagedFields
}).strict().transform(omitServerManagedFields);

const collectionUpsertSchemas = {
  agents: agentUpsertSchema,
  skills: skillSchema
} as const;

export type MutableCollectionName = keyof typeof collectionUpsertSchemas;

export const collectionUpsertSchema = <T extends MutableCollectionName>(
  collection: T
): z.ZodType<WorkspaceSaveRequestByCollection[T]> =>
  collectionUpsertSchemas[collection] as unknown as z.ZodType<WorkspaceSaveRequestByCollection[T]>;

const kebabCaseIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const optionalAutomationDescriptionSchema = z.string().max(2000);
const automationLoopIdSchema = z.string().min(2).max(101);
const automationStepIdSchema = z.string()
  .min(1)
  .max(160)
  .regex(kebabCaseIdPattern, "Step id must be lowercase kebab-case.");
const kebabLoopIdSchema = automationLoopIdSchema.regex(kebabCaseIdPattern, "Loop id must be lowercase kebab-case.");
const loopThemeColorSchema = z.string()
  .regex(/^#[0-9a-f]{6}$/, "Expected a six-digit lowercase hex color.");

export const loopThemeSchema = z.object({
  version: z.literal(2),
  node: z.object({
    labelColor: loopThemeColorSchema,
    glowColor: loopThemeColorSchema,
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
  nodeStyle: z.enum(loopNodeStyles),
  on: stepTransitionsSchema
};
const calendarDateSchema = z.string().refine(isCalendarDate, "Expected a valid date in YYYY-MM-DD format.");
const clockTimeSchema = z.string().regex(clockTimePattern, "Expected a valid time in HH:mm format.");
const timeZoneSchema = z.string().min(1).refine(isIanaTimeZone, "Expected a valid IANA time zone.");
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
    ...executableStepBase,
    type: z.literal("scheduled"),
    agentId: z.string().min(1),
    schedule: projectStepScheduleSchema,
  }).strict()
]);

const projectLoopSchema = z.object({
  id: kebabLoopIdSchema,
  start: automationStepIdSchema,
  steps: z.array(projectStepSchema).min(1)
}).strict();

export const automationConfigSchema = z.object({
  version: z.literal(7),
  loops: z.array(projectLoopSchema)
}).strict() satisfies z.ZodType<ProjectAutomationConfig>;

export const projectConfigSchema = z.object({
  version: z.literal(7),
  agents: z.record(z.string().trim().min(1).max(200), portableAgentRuntimeIntentSchema),
  loops: z.array(projectLoopSchema)
}).strict() satisfies z.ZodType<ProjectConfiguration>;
