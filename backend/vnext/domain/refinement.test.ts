import { describe, expect, it } from "vitest";
import {
  isAllowedCanonicalRefinementPath, isAllowedRefinementPath,
  isAllowedVNextRefinementPath, validateRefinementImpact
} from "../../../shared/vnext/index.js";

describe("refinement safety", () => {
  it.each([
    [".ballet/instructions/work.md", true],
    [".agents/skills/review/SKILL.md", true],
    [".agents/skills/group/review/SKILL.md", true],
    [".ballet/vnext/instructions/work.md", true],
    [".ballet/vnext/skills/review.md", true],
    [".ballet/project.json", false],
    ["/tmp/SKILL.md", false],
    [".agents/skills/../secret/SKILL.md", false],
    [".agents\\skills\\review\\SKILL.md", false],
    [".agents/skills/review/README.md", false]
  ])("classifies %s", (path, expected) => {
    expect(isAllowedRefinementPath(path)).toBe(expected);
  });

  it("keeps canonical and transition refinement namespaces mutually exclusive", () => {
    expect(isAllowedCanonicalRefinementPath(".ballet/instructions/work.md")).toBe(true);
    expect(isAllowedCanonicalRefinementPath(".ballet/vnext/instructions/work.md")).toBe(false);
    expect(isAllowedVNextRefinementPath(".ballet/vnext/instructions/work.md")).toBe(true);
    expect(isAllowedVNextRefinementPath(".ballet/instructions/work.md")).toBe(false);
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
