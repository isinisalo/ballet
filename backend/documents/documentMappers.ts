import type { EntityStatus, MarkdownDocument, Project } from "../../shared/domain/documents.js";
import { stringValue } from "./documentValues.js";

const missingDate = new Date(0).toISOString();

const validEntityStatus = (value: unknown): EntityStatus =>
  ["active", "paused", "archived"].includes(stringValue(value)) ? stringValue(value) as EntityStatus : "active";

const dateValue = (value: unknown): string => stringValue(value, missingDate);

const attachDocument = <T extends object>(entity: T, doc: MarkdownDocument): T => ({
  ...entity,
  frontmatter: doc.frontmatter,
  body: doc.body,
  relativePath: doc.relativePath,
  slug: doc.slug,
  errors: doc.errors
});

export const projectFromDocument = (doc: MarkdownDocument): Project => {
  const fm = doc.frontmatter;
  return attachDocument({
    id: doc.id,
    name: stringValue(fm.name, stringValue(fm.title, doc.title ?? doc.slug)),
    description: doc.body.trim(),
    status: validEntityStatus(fm.status),
    createdAt: dateValue(fm.createdAt),
    updatedAt: dateValue(fm.updatedAt ?? fm.createdAt)
  }, doc);
};
