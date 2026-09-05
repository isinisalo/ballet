import { describe, expect, it } from "vitest";
import { skillImpactWarning } from "../src/orchestration/authoringModels";
import { authoringModels, unsupportedAuthoringModelMessage } from "../src/orchestration/configure/agentModelPolicy";

describe("orchestration authoring pure models", () => {
  it("shows shared Skill reverse impact", () => { expect(skillImpactWarning("skill", [{ kind: "skill", id: "skill", references: [{}, {}] }])).toBe("Shared Skill impacts 2 referencing roles."); });
  it("filters and orders authoring models as Sol, Terra and Luna", () => {
    const model = (id: string) => ({ id, label: id, reasoningOptions: ["medium"] });
    expect(authoringModels([model("gpt-5.6-luna"), model("gpt-5.5"), model("gpt-5.6-sol"), model("gpt-5.6-terra")]).map(({ id }) => id))
      .toEqual(["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]);
    expect(unsupportedAuthoringModelMessage("gpt-5.5")).toContain("Choose gpt-5.6-sol, gpt-5.6-terra, or gpt-5.6-luna");
  });
});
