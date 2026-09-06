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

export function projectMarkdownValidation(kind: "overview" | "adrs", draft: MarkdownDraft, currentId: string, creating: boolean) {
  let id = currentId;
  try {
    const metadata = draft.frontmatterText.trim() ? parseFrontmatterYaml(draft.frontmatterText) : {};
    if (kind === "adrs") {
      if (typeof metadata.id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(metadata.id)) throw new Error("A safe document ID is required.");
      if (!creating && metadata.id !== currentId) throw new Error("The document ID cannot change.");
      if (typeof metadata.title !== "string" || !metadata.title.trim()) throw new Error("A title is required.");
      id = metadata.id;
    }
    if (!draft.bodyText.trim()) throw new Error("Markdown content is required.");
    return { id, validation: "" };
  } catch (reason) { return { id, validation: reason instanceof Error ? reason.message : "Invalid Markdown." }; }
}
