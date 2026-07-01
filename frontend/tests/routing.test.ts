import { describe, expect, it } from "vitest";
import {
  agentDocumentPath,
  automationSectionPath,
  projectDocumentPath,
  routeFromPath,
  runtimePath,
  skillDocumentPath
} from "../src/workspace/routing";

describe("workspace routing", () => {
  it("parses project document and collection routes", () => {
    expect(routeFromPath("/projects/document?path=.ballet%2Fgoals%2Fone.md")).toEqual({
      view: "project-document",
      documentPath: ".ballet/goals/one.md"
    });
    expect(routeFromPath("/projects/project%201/goals")).toEqual({ view: "project-goals", projectId: "project 1" });
    expect(routeFromPath("/projects/project-1/adrs")).toEqual({ view: "project-adrs", projectId: "project-1" });
    expect(routeFromPath("/projects/project-1/instructions")).toEqual({ view: "project-instructions", projectId: "project-1" });
  });

  it("parses automation aliases and selected entities", () => {
    expect(routeFromPath("/automation/actions?id=build")).toEqual({
      view: "automation",
      automationTab: "actions",
      automationEntityId: "build"
    });
    expect(routeFromPath("/policies?id=policy-1")).toEqual({
      view: "automation",
      automationTab: "workflows",
      automationEntityId: "policy-1"
    });
    expect(routeFromPath("/automation/runtimes?id=codex")).toEqual({ view: "runtimes", runtimeId: "codex" });
  });

  it("builds encoded paths", () => {
    expect(projectDocumentPath(".ballet/goals/a b.md")).toBe("/projects/document?path=.ballet%2Fgoals%2Fa%20b.md");
    expect(agentDocumentPath(".codex/agents/a b.toml")).toBe("/agents?path=.codex%2Fagents%2Fa%20b.toml");
    expect(skillDocumentPath(".agents/skills/a/SKILL.md")).toBe("/skills?path=.agents%2Fskills%2Fa%2FSKILL.md");
    expect(automationSectionPath("workflows", "wf 1")).toBe("/automation/workflows?id=wf%201");
    expect(runtimePath("runtime 1")).toBe("/runtimes?id=runtime%201");
  });
});
