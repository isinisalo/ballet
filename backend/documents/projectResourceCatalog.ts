import { createHash } from "node:crypto";
import { constants, type Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ProjectInstruction,
  ProjectResourceCatalog,
  ProjectResourceIssue,
  Skill
} from "../../shared/domain/documents.js";
import { parseMarkdownDocument } from "../markdown.js";
import { MarkdownEntityValidationError } from "./MarkdownEntityErrors.js";
import { resolveSafeProjectPath } from "./safeProjectPath.js";

const instructionRoot = ".ballet/instructions";
const skillRoot = ".agents/skills";
const kebabCaseSegment = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type LoadedResources<T> = { resources: T[]; issues: ProjectResourceIssue[] };

export const loadProjectResources = async (root: string): Promise<ProjectResourceCatalog> => {
  const [instructions, skills] = await Promise.all([
    loadInstructionResources(root),
    loadSkillResources(root)
  ]);
  return {
    instructions: instructions.resources,
    skills: skills.resources,
    issues: [...instructions.issues, ...skills.issues]
  };
};

export const loadProjectInstructions = async (root: string): Promise<ProjectInstruction[]> =>
  (await loadInstructionResources(root)).resources;

export const loadProjectSkills = async (root: string): Promise<Skill[]> =>
  (await loadSkillResources(root)).resources;

const loadInstructionResources = async (root: string): Promise<LoadedResources<ProjectInstruction>> => {
  const relativePaths = (await walkProjectFiles(root, instructionRoot, (entry) =>
    entry.isFile() && path.extname(entry.name).toLowerCase() === ".md"));
  const issues: ProjectResourceIssue[] = [];
  const resources = await Promise.all(relativePaths.map(async (relativePath): Promise<ProjectInstruction> => {
    const file = await readUtf8ProjectFile(root, relativePath);
    const source = file.source;
    const parsed = parseMarkdownDocument(source);
    const errors = [...(file.error ? [file.error] : []), ...(parsed.errors ?? [])];
    const rawId = parsed.frontmatter.id;
    const rawTitle = parsed.frontmatter.title;
    let projectId: string | undefined;
    let id: string | undefined;

    if (file.error) issues.push({
      kind: "instruction",
      code: "invalid_utf8",
      relativePath,
      message: file.error
    });

    if (rawId === undefined) {
      errors.push("Instruction frontmatter id is required before this document can be selected.");
    } else if (typeof rawId !== "string" || !kebabCaseSegment.test(rawId)) {
      const message = "Instruction frontmatter id must be lowercase kebab-case.";
      errors.push(message);
      issues.push({ kind: "instruction", code: "invalid_id", relativePath, message });
    } else {
      projectId = rawId;
      id = `project:${rawId}`;
    }

    if (typeof rawTitle !== "string" || !rawTitle.trim()) {
      const message = "Instruction frontmatter title must be a non-empty string.";
      errors.push(message);
      if (rawId !== undefined) issues.push({ kind: "instruction", code: "invalid_frontmatter", relativePath, resourceId: id, message });
    }
    if (parsed.errors?.length) {
      issues.push({
        kind: "instruction",
        code: "invalid_frontmatter",
        relativePath,
        resourceId: id,
        message: `Instruction frontmatter is invalid: ${parsed.errors.join("; ")}`
      });
    }
    if (!parsed.body.trim()) {
      const message = "Instruction content must be non-empty.";
      errors.push(message);
      if (rawId !== undefined) issues.push({ kind: "instruction", code: "empty_content", relativePath, resourceId: id, message });
    }

    return {
      ...(id ? { id } : {}),
      ...(projectId ? { projectId } : {}),
      title: typeof rawTitle === "string" && rawTitle.trim() ? rawTitle.trim() : path.basename(relativePath, ".md"),
      origin: "project",
      valid: errors.length === 0,
      frontmatter: parsed.frontmatter,
      body: parsed.body,
      relativePath,
      slug: path.basename(relativePath, ".md"),
      ...(errors.length > 0 ? { errors } : {}),
      sourceSha256: sha256(file.bytes),
      contentSha256: sha256(parsed.body),
      sizeBytes: Buffer.byteLength(parsed.body, "utf8")
    };
  }));
  return markDuplicateIds(resources, issues, "instruction");
};

const loadSkillResources = async (root: string): Promise<LoadedResources<Skill>> => {
  const relativePaths = await walkProjectFiles(root, skillRoot, (entry) => entry.isFile() && entry.name === "SKILL.md");
  const issues: ProjectResourceIssue[] = [];
  const resources = await Promise.all(relativePaths.map(async (relativePath): Promise<Skill> => {
    const file = await readUtf8ProjectFile(root, relativePath);
    const source = file.source;
    const parsed = parseMarkdownDocument(source);
    const relativeDirectory = posix(path.relative(skillRoot, path.dirname(relativePath)));
    const segments = relativeDirectory.split("/").filter(Boolean);
    const projectId = segments.join("/");
    const id = `project:${projectId}`;
    const errors = [...(file.error ? [file.error] : []), ...(parsed.errors ?? [])];
    const invalidSegment = segments.find((segment) => !kebabCaseSegment.test(segment));

    if (file.error) issues.push({
      kind: "skill",
      code: "invalid_utf8",
      relativePath,
      resourceId: id,
      message: file.error
    });

    if (segments.length === 0 || invalidSegment) {
      const message = invalidSegment
        ? `Skill path segment must be lowercase kebab-case: ${invalidSegment}.`
        : "SKILL.md must be inside a named skill directory.";
      errors.push(message);
      issues.push({ kind: "skill", code: "invalid_path", relativePath, resourceId: id, message });
    }
    if (parsed.errors?.length) issues.push({
      kind: "skill",
      code: "invalid_frontmatter",
      relativePath,
      resourceId: id,
      message: `Skill frontmatter is invalid: ${parsed.errors.join("; ")}`
    });
    if (!parsed.body.trim()) {
      const message = "Skill content must be non-empty.";
      errors.push(message);
      issues.push({ kind: "skill", code: "empty_content", relativePath, resourceId: id, message });
    }

    const rawName = parsed.frontmatter.name ?? parsed.frontmatter.title;
    const name = typeof rawName === "string" && rawName.trim()
      ? rawName.trim()
      : segments.at(-1) ?? "invalid-skill";
    const rawDescription = parsed.frontmatter.description;
    const description = typeof rawDescription === "string" ? rawDescription : bodyPreview(parsed.body);
    return {
      id,
      projectId,
      name,
      description,
      metadata: Object.fromEntries(Object.entries(parsed.frontmatter)
        .filter(([key]) => !["id", "name", "title", "description"].includes(key))
        .map(([key, value]) => [key, typeof value === "string" ? value : String(value)])),
      origin: "project",
      valid: errors.length === 0,
      frontmatter: parsed.frontmatter,
      body: parsed.body,
      relativePath,
      slug: projectId,
      ...(errors.length > 0 ? { errors } : {}),
      sourceSha256: sha256(file.bytes),
      contentSha256: sha256(parsed.body),
      sizeBytes: Buffer.byteLength(parsed.body, "utf8")
    };
  }));
  return markDuplicateIds(resources, issues, "skill");
};

const markDuplicateIds = <T extends ProjectInstruction | Skill>(
  resources: T[],
  issues: ProjectResourceIssue[],
  kind: "instruction" | "skill"
): LoadedResources<T> => {
  const counts = new Map<string, number>();
  for (const resource of resources) {
    if (resource.id) counts.set(resource.id, (counts.get(resource.id) ?? 0) + 1);
  }
  const next = resources.map((resource) => {
    if (!resource.id || counts.get(resource.id) === 1) return resource;
    const message = `Duplicate ${kind} id: ${resource.id}.`;
    issues.push({ kind, code: "duplicate_id", relativePath: resource.relativePath ?? "", resourceId: resource.id, message });
    return { ...resource, valid: false, errors: [...(resource.errors ?? []), message] };
  });
  return { resources: next.sort(compareResources), issues };
};

const walkProjectFiles = async (
  root: string,
  relativeDirectory: string,
  include: (entry: Dirent) => boolean
): Promise<string[]> => {
  const absoluteDirectory = await resolveSafeProjectPath(root, relativeDirectory);
  let entries: Dirent[];
  try {
    entries = await readdir(absoluteDirectory, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  const symbolicLink = entries.find((entry) => entry.isSymbolicLink());
  if (symbolicLink) throw new MarkdownEntityValidationError(
    `Symbolic links are not allowed in project resource paths: ${posix(path.join(relativeDirectory, symbolicLink.name))}`
  );
  const files = entries.filter(include).map((entry) => posix(path.join(relativeDirectory, entry.name)));
  const nested = await Promise.all(entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => walkProjectFiles(root, posix(path.join(relativeDirectory, entry.name)), include)));
  return [...files, ...nested.flat()].sort(compareText);
};

const readUtf8ProjectFile = async (
  root: string,
  relativePath: string
): Promise<{ source: string; bytes: Buffer; error?: string }> => {
  const absolutePath = await resolveSafeProjectPath(root, relativePath);
  const bytes = await readFile(absolutePath, { flag: constants.O_RDONLY | constants.O_NOFOLLOW });
  try {
    return { source: new TextDecoder("utf-8", { fatal: true }).decode(bytes), bytes };
  } catch {
    return { source: "", bytes, error: "Project resource must contain valid UTF-8." };
  }
};

const bodyPreview = (body: string): string => body.replace(/^#+\s+/gm, "").split(/\n{2,}/)[0]?.trim() ?? "";
const sha256 = (source: string | Uint8Array): string => createHash("sha256").update(source).digest("hex");
const posix = (value: string): string => value.split(path.sep).join("/");
const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const compareResources = (left: ProjectInstruction | Skill, right: ProjectInstruction | Skill): number =>
  compareText(left.id ?? left.relativePath ?? "", right.id ?? right.relativePath ?? "");
const isMissing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
