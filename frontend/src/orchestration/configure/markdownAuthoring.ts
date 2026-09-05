import type { Constraint, DirectionReference, UseCase, UseCaseExample } from "@shared/orchestration/direction";
import { invalidateUseCaseApproval } from "@shared/orchestration/direction";
import { parseFrontmatterYaml, frontmatterToYaml } from "@/workspace/documents/frontmatter";
import type { ResourceDocument } from "../types";

export type MarkdownDirectionKind = "goals" | "adrs" | "constraints" | "use-cases";
export type MarkdownDirectionValue = DirectionReference | Constraint | UseCase;

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

export const createMarkdownDocument = (kind: MarkdownDirectionKind): ResourceDocument => {
  const singular = kind === "use-cases" ? "Use Case" : kind === "adrs" ? "ADR" : kind.slice(0, -1);
  const frontmatter: Record<string, unknown> = { id: "", title: `New ${singular}`, status: kind === "use-cases" ? "draft" : "draft" };
  if (kind === "constraints") Object.assign(frontmatter, { kind: "required", description: "", rationale: "" });
  if (kind === "use-cases") Object.assign(frontmatter, {
    examples: [{ given: "", when: "", then: "" }], successGoals: [], failureGoals: [], expectedOutcomes: [],
    goalIds: [], adrIds: [], constraintIds: []
  });
  const draft = { frontmatterText: frontmatterToYaml(frontmatter), bodyText: `# New ${singular}\n\nDescribe the intent here.` };
  return { kind: kind.slice(0, -1) as ResourceDocument["kind"], id: "new", content: joinMarkdownSource(draft), contentHash: "absent" };
};

/* eslint-disable complexity -- One closed authoring boundary preserves kind-specific frontmatter without parallel form truth. */
export const directionValueFromMarkdown = (
  kind: MarkdownDirectionKind,
  draft: MarkdownDraft,
  current?: MarkdownDirectionValue
): { value: MarkdownDirectionValue; source: string } => {
  const frontmatter = parseFrontmatterYaml(draft.frontmatterText);
  const id = requiredString(frontmatter.id, "Frontmatter id is required.");
  const name = requiredString(frontmatter.title ?? frontmatter.name, "Frontmatter title is required.");
  if (kind === "goals" || kind === "adrs") {
    const status = directionStatus(frontmatter.status);
    return { value: { id, name, status }, source: joinMarkdownSource(draft) };
  }
  if (kind === "constraints") {
    const value: Constraint = {
      id, name, status: directionStatus(frontmatter.status),
      kind: frontmatter.kind === "prohibited" ? "prohibited" : "required",
      description: stringValue(frontmatter.description) ?? (current && "description" in current ? current.description : firstParagraph(draft.bodyText)),
      rationale: stringValue(frontmatter.rationale) ?? (current && "rationale" in current ? current.rationale : firstParagraph(draft.bodyText)),
      ...(stringValue(frontmatter.scope) ? { scope: stringValue(frontmatter.scope) } : {})
    };
    return { value, source: joinMarkdownSource(draft) };
  }
  const existing = current && "examples" in current ? current : undefined;
  const candidate: UseCase = {
    id, name, status: existing?.status ?? "draft",
    examples: examples(frontmatter.examples),
    successGoals: strings(frontmatter.successGoals), failureGoals: strings(frontmatter.failureGoals),
    expectedOutcomes: strings(frontmatter.expectedOutcomes), goalIds: strings(frontmatter.goalIds),
    adrIds: strings(frontmatter.adrIds), constraintIds: strings(frontmatter.constraintIds),
    ...(existing?.approvalRevision !== undefined ? { approvalRevision: existing.approvalRevision } : {}),
    ...(existing?.approval ? { approval: existing.approval } : {})
  };
  const value = existing ? invalidateUseCaseApproval(existing, candidate) : candidate;
  const synchronized: Record<string, unknown> = { ...frontmatter, id, title: name, status: value.status };
  if (value.approval) synchronized.approval = value.approval;
  else delete synchronized.approval;
  return { value, source: joinMarkdownSource({ ...draft, frontmatterText: frontmatterToYaml(synchronized) }) };
};
/* eslint-enable complexity */

const stringValue = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value.trim() : undefined;
const requiredString = (value: unknown, message: string): string => { const parsed = stringValue(value); if (!parsed) throw new Error(message); return parsed; };
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [];
const examples = (value: unknown): UseCaseExample[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const given = stringValue(Reflect.get(item, "given")); const when = stringValue(Reflect.get(item, "when")); const then = stringValue(Reflect.get(item, "then"));
    return given && when && then ? [{ given, when, then }] : [];
  });
};
const directionStatus = (value: unknown): DirectionReference["status"] => value === "accepted" || value === "superseded" ? value : "draft";
const firstParagraph = (body: string): string => body.replace(/^#.*\n+/, "").split(/\n\s*\n/)[0]?.trim() ?? "";
