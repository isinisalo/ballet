import { z } from "zod";

export const tkTicketSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["open", "in_progress", "closed"]),
  deps: z.array(z.string().min(1)),
  links: z.array(z.string().min(1)),
  created: z.string().min(1),
  type: z.enum(["bug", "feature", "task", "epic", "chore"]),
  priority: z.union([z.string().regex(/^[0-4]$/), z.number().int().min(0).max(4)]),
  assignee: z.string().optional(),
  "external-ref": z.string().min(1).optional(),
  parent: z.string().min(1).optional()
}).strict();

export type TkTicket = Omit<z.infer<typeof tkTicketSchema>, "priority"> & { priority: number };
export type TkStoreKind = "orchestration" | "work";
export type TkTicketType = "bug" | "feature" | "task" | "epic" | "chore";

export interface TkUpsertInput {
  externalRef: string;
  title: string;
  type: TkTicketType;
  priority?: number;
  description?: string;
  design?: string;
  acceptance?: string;
  parentId?: string;
  dependencyIds?: string[];
}

export interface TkClaimInput {
  releaseTicketId: string;
}
