import { parseFrontmatterYaml } from "@/workspace/documents/frontmatter";
import type { ResourceDocument } from "../types";


export interface MarkdownDraft {
  frontmatterText: string;
  bodyText: string;
}

export const splitMarkdownSource = (source: string): MarkdownDraft => {
  const normalized = source.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  return match
    ? { frontmatterText: match[1] ?? "", bodyText: (match[2] ?? "").replace(/^\n/, "") }
    : { frontmatterText: "", bodyText: normalized };
};

export const joinMarkdownSource = ({ frontmatterText, bodyText }: MarkdownDraft): string =>
  `---\n${frontmatterText.trimEnd()}\n---\n\n${bodyText.replace(/^\n+/, "").trimEnd()}\n`;

export const markdownEntity = (document: ResourceDocument, draft: MarkdownDraft) => {
  let frontmatter: Record<string, unknown> = {};
  try { frontmatter = parseFrontmatterYaml(draft.frontmatterText); }
  catch { /* The owning editor renders the validation error beside the source field. */ }
  return {
    id: document.id,
    frontmatter,
    title: stringValue(frontmatter.title) ?? stringValue(frontmatter.name) ?? document.id
  };
};

const stringValue = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value.trim() : undefined;

export function projectMarkdownValidation(draft: MarkdownDraft) {
  try {
    if (draft.frontmatterText.trim()) parseFrontmatterYaml(draft.frontmatterText);
    if (!draft.bodyText.trim()) throw new Error("Markdown content is required.");
    return { validation: "" };
  } catch (reason) { return { validation: reason instanceof Error ? reason.message : "Invalid Markdown." }; }
}
