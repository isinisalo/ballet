import { z } from "zod";
import { VNEXT_LIMITS } from "../limits.js";

export const idSchema = z.string().trim().min(1).max(200);
export const textSchema = z.string().max(VNEXT_LIMITS.text);
export const nonEmptyTextSchema = textSchema.trim().min(1);
export const timestampSchema = z.string().datetime({ offset: true });
export const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
export const gitObjectIdSchema = z.string().regex(/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/);
export const idListSchema = z.array(idSchema).max(VNEXT_LIMITS.referencesPerItem);

export const checkEvidenceSchema = z.object({
  name: nonEmptyTextSchema,
  status: z.enum(["passed", "failed", "skipped"]),
  details: textSchema.optional(),
  evidenceRefs: idListSchema
}).strict();
