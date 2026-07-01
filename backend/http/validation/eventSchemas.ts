import { z } from "zod";

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

export const agentRunParamsSchema = z.object({
  id: z.string().min(1)
}).strict();
