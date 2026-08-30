import { describe, expect, it } from "vitest";
import {
  isAllowedRefinementPath, validateRefinementImpact
} from "../../../shared/orchestration/index.js";

describe("refinement safety", () => {
  it.each([
    [".ballet/instructions/work.md", true],
    [".agents/skills/review/SKILL.md", true],
    [".agents/skills/group/review/SKILL.md", true],
    [".ballet/project.json", false],
    ["/tmp/SKILL.md", false],
    [".agents/skills/../secret/SKILL.md", false],
    [".agents\\skills\\review\\SKILL.md", false],
    [".agents/skills/review/README.md", false]
  ])("classifies %s", (path, expected) => {
    expect(isAllowedRefinementPath(path)).toBe(expected);
  });

  it("accepts only canonical refinement namespaces", () => {
    expect(isAllowedRefinementPath(".ballet/instructions/work.md")).toBe(true);
    expect(isAllowedRefinementPath(".agents/skills/review/SKILL.md")).toBe(true);
    expect(isAllowedRefinementPath(".codex/agents/ballet-action-validation-action-1.toml")).toBe(true);
    expect(isAllowedRefinementPath(".ballet/project.json")).toBe(false);
  });

  it("rejects symlinks and missing shared Skill impact closure together", () => {
    const issues = validateRefinementImpact({
      files: [{
        relativePath: ".agents/skills/review/SKILL.md", kind: "symlink",
        preimageSha256: "a".repeat(64), proposedContentSha256: "b".repeat(64), resourceId: "skill:review"
      }],
      sharedSkillReferences: { "skill:review": ["action-1", "action-2"] },
      declaredImpact: [{ resourceId: "skill:review", actionIds: ["action-1"] }]
    });
    expect(issues.map(({ code }) => code)).toEqual(["refinement_symlink", "missing_shared_skill_impact"]);
  });

  it("accepts an exact closed impact declaration", () => {
    expect(validateRefinementImpact({
      files: [{
        relativePath: ".agents/skills/review/SKILL.md", kind: "regular",
        preimageSha256: "a".repeat(64), proposedContentSha256: "b".repeat(64), resourceId: "skill:review"
      }],
      sharedSkillReferences: { "skill:review": ["action-1", "action-2"] },
      declaredImpact: [{ resourceId: "skill:review", actionIds: ["action-2", "action-1"] }]
    })).toEqual([]);
  });
});
