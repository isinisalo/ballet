import { z } from "zod";
import type { ProjectAutomationConfig } from "../../../shared/domain/automation.js";

const projectTriggerSchema = z.object({
  id: z.string(),
  description: z.string()
}).strict();

const projectActionSchema = z.object({
  id: z.string(),
  description: z.string()
}).strict();

const projectPolicySchema = z.object({
  id: z.string(),
  source: z.enum(["event", "trigger"]),
  event: z.string().optional(),
  trigger: z.string().optional(),
  agent: z.string(),
  action: z.string(),
  enabled: z.boolean()
}).strict();

const projectWorkflowSchema = z.object({
  id: z.string(),
  title: z.string(),
  steps: z.array(z.string())
}).strict();

const projectRuntimeSchema = z.object({
  id: z.string(),
  title: z.string(),
  command: z.string(),
  args: z.array(z.string())
}).strict();

export const automationConfigSchema = z.object({
  version: z.literal(1),
  triggers: z.array(projectTriggerSchema),
  actions: z.array(projectActionSchema),
  policies: z.array(projectPolicySchema),
  workflows: z.array(projectWorkflowSchema),
  runtimes: z.array(projectRuntimeSchema)
}).strict() satisfies z.ZodType<ProjectAutomationConfig>;
