import path from "node:path";
import type { Skill } from "../../shared/domain/documents.js";
import { safeSlug } from "../markdown.js";
import { booleanValue, isRecord, stringValue } from "./documentValues.js";

const skillFromUnknown = (value: unknown, index: number): Skill => {
  if (isRecord(value)) {
    const name = stringValue(value.name ?? value.id, `skill-${index + 1}`);
    const metadata = Object.fromEntries(Object.entries(value).filter(([key]) => !["id", "name", "description", "enabled"].includes(key)).map(([key, item]) => [key, stringValue(item)]));
    return {
      id: stringValue(value.id, safeSlug(name)),
      name,
      description: stringValue(value.description),
      metadata,
      enabled: booleanValue(value.enabled, true)
    };
  }
  const name = stringValue(value, `skill-${index + 1}`);
  return { id: safeSlug(name), name, description: "", metadata: {}, enabled: true };
};

const normalizeSkillConfigPath = (value: string): string => {
  const trimmed = value.trim().replaceAll("\\", "/").replace(/\/SKILL\.md$/i, "");
  const segments = trimmed.split("/").filter(Boolean);
  const agentsSkillsIndex = segments.findIndex((segment, index) => segment === ".agents" && segments[index + 1] === "skills");
  if (agentsSkillsIndex >= 0) return segments.slice(agentsSkillsIndex).join("/");
  return path.posix.normalize(trimmed).replace(/^\.\//, "");
};

const skillLookupKeys = (skill: Skill): string[] => {
  const keys = [skill.id, skill.slug].filter(Boolean) as string[];
  if (skill.relativePath) {
    const normalized = normalizeSkillConfigPath(skill.relativePath);
    keys.push(normalized, normalized.replace(/\/SKILL\.md$/i, ""), path.posix.basename(normalized.replace(/\/SKILL\.md$/i, "")));
  }
  return [...new Set(keys)];
};

export const buildSkillLookup = (skills: Skill[]): Map<string, Skill> => {
  const lookup = new Map<string, Skill>();
  for (const skill of skills) {
    for (const key of skillLookupKeys(skill)) {
      lookup.set(key, skill);
    }
  }
  return lookup;
};

const skillFromConfig = (value: unknown, index: number, skillLookup: Map<string, Skill>): Skill | undefined => {
  if (!isRecord(value)) return undefined;
  const rawPath = stringValue(value.path).trim();
  if (!rawPath) return undefined;

  const normalizedPath = normalizeSkillConfigPath(rawPath);
  const name = path.posix.basename(normalizedPath) || `skill-${index + 1}`;
  const enabled = booleanValue(value.enabled, true);
  const matchedSkill = skillLookup.get(normalizedPath) ?? skillLookup.get(name) ?? skillLookup.get(safeSlug(name));
  const metadata = { ...(matchedSkill?.metadata ?? {}), path: rawPath };

  return matchedSkill
    ? { ...matchedSkill, metadata, enabled }
    : {
      id: safeSlug(name),
      name,
      description: "",
      metadata,
      enabled
    };
};

export const agentSkillsFromFrontmatter = (fm: Record<string, unknown>, skillLookup: Map<string, Skill>): Skill[] => {
  if (Array.isArray(fm.skills)) return fm.skills.map(skillFromUnknown);

  if (isRecord(fm.skills) && Array.isArray(fm.skills.config)) {
    return fm.skills.config
      .map((skill, index) => skillFromConfig(skill, index, skillLookup))
      .filter((skill): skill is Skill => Boolean(skill));
  }

  return [];
};
