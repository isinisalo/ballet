import type { ContractIssue } from "./primitives.js";

export interface RefinementCandidateFile {
  relativePath: string;
  kind: "new" | "regular" | "symlink";
  preimageSha256: string;
  proposedContentSha256: string;
  resourceId?: string;
}

export interface SharedSkillImpact {
  resourceId: string;
  actionIds: string[];
}

export interface RefinementImpactInput {
  files: RefinementCandidateFile[];
  sharedSkillReferences: Record<string, string[]>;
  declaredImpact: SharedSkillImpact[];
}

const isSafeRelativePath = (path: string): boolean => (
  path.length > 0 && !path.startsWith("/") && !path.includes("\\") && !path.split("/").includes("..")
);

export const isAllowedRefinementPath = (path: string): boolean => (
  isSafeRelativePath(path) && (
    /^\.ballet\/instructions\/.+\.md$/.test(path)
    || /^\.agents\/skills\/[^/]+(?:\/[^/]+)*\/SKILL\.md$/.test(path)
  )
);

export const validateRefinementImpact = (input: RefinementImpactInput): ContractIssue[] => {
  const issues: ContractIssue[] = [];
  const impacts = new Map(input.declaredImpact.map((impact) => [impact.resourceId, new Set(impact.actionIds)]));
  for (const [index, file] of input.files.entries()) {
    const path = `files.${index}`;
    if (!isAllowedRefinementPath(file.relativePath)) {
      issues.push({ code: "refinement_path_not_allowed", path: `${path}.relativePath`, message: `${file.relativePath} is outside refinement scope` });
    }
    if (file.kind === "symlink") issues.push({ code: "refinement_symlink", path: `${path}.kind`, message: "Symlink targets are prohibited" });
    if (!file.resourceId) continue;
    const requiredActions = input.sharedSkillReferences[file.resourceId] ?? [];
    const declaredActions = impacts.get(file.resourceId) ?? new Set<string>();
    for (const actionId of requiredActions) {
      if (!declaredActions.has(actionId)) {
        issues.push({ code: "missing_shared_skill_impact", path: "declaredImpact", message: `${file.resourceId} impact omits ${actionId}` });
      }
    }
  }
  return issues;
};

export const validateRefinementImpactScope = validateRefinementImpact;
