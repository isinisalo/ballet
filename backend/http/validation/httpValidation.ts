import type { Request } from "express";
import { z, type ZodType } from "zod";

export interface HttpValidationIssue {
  path: string;
  message: string;
  code: string;
}

export class HttpValidationError extends Error {
  constructor(
    message = "Request validation failed.",
    public readonly issues: HttpValidationIssue[] = [],
    public readonly status = 400
  ) {
    super(message);
    this.name = "HttpValidationError";
  }
}

const issuePath = (path: PropertyKey[]): string =>
  path.length > 0 ? path.map(String).join(".") : "$";

const formatIssues = (error: z.ZodError): HttpValidationIssue[] =>
  error.issues.map((issue) => ({
    path: issuePath(issue.path),
    message: issue.message,
    code: issue.code
  }));

export const parseUnknown = <T>(schema: ZodType<T>, value: unknown): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new HttpValidationError("Request validation failed.", formatIssues(parsed.error));
  }
  return parsed.data;
};

export const parseBody = <T>(schema: ZodType<T>, req: Request): T =>
  parseUnknown(schema, req.body);

export const parseParams = <T>(schema: ZodType<T>, req: Request): T =>
  parseUnknown(schema, req.params);
