import { describe, expect, it } from "vitest";
import {
  agentDocumentPath,
  automationAllLoopsPath,
  automationLoopPath,
  projectCollectionDocumentPath,
  projectDocumentPath,
  routeFromPath,
  runAgentPath,
  runLoopPath,
  runOverviewPath,
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
    expect(routeFromPath("/projects/project%201/goals?path=.ballet%2Fgoals%2Fone.md")).toEqual({
      view: "project-goals",
      projectId: "project 1",
      documentPath: ".ballet/goals/one.md"
    });
    expect(routeFromPath("/projects/project-1/adrs")).toEqual({ view: "project-adrs", projectId: "project-1" });
    expect(routeFromPath("/projects/project-1/adrs?path=.ballet%2Fadr%2Fdecision.md")).toEqual({
      view: "project-adrs",
      projectId: "project-1",
      documentPath: ".ballet/adr/decision.md"
    });
    expect(routeFromPath("/projects/project-1/instructions")).toEqual({ view: "project-instructions", projectId: "project-1" });
    expect(routeFromPath("/projects/project-1/instructions?path=.ballet%2Finstructions%2Freviewer.md")).toEqual({
      view: "project-instructions",
      projectId: "project-1",
      documentPath: ".ballet/instructions/reviewer.md"
    });
  });

  it("parses canonical automation and runtime routes with selected entities", () => {
    expect(routeFromPath("/automation/loops?id=build")).toEqual({ view: "automation", automationEntityId: "build" });
    expect(routeFromPath("/automation/outputs?id=artifact")).toEqual({ view: "projects" });
    expect(routeFromPath("/automation/loops?view=all")).toEqual({
      view: "automation",
      automationLoopView: "all"
    });
    expect(routeFromPath("/automation/gates?id=gate-1")).toEqual({ view: "projects" });
    expect(routeFromPath("/runtimes?id=device-1")).toEqual({ view: "runtimes", runtimeDeviceId: "device-1" });
  });

  it("parses URL-backed Ballet Run routes", () => {
    expect(routeFromPath("/run")).toEqual({ view: "run", rootRunId: undefined });
    expect(routeFromPath("/run/loops/release%20train?run=root-1")).toEqual({ view: "run", runTargetKind: "loop", runTargetId: "release train", rootRunId: "root-1" });
    expect(routeFromPath("/run/agents/reviewer?run=root-2")).toEqual({ view: "run", runTargetKind: "agent", runTargetId: "reviewer", rootRunId: "root-2" });
  });

  it("does not keep legacy automation route aliases", () => {
    expect(routeFromPath("/automation/policies?id=policy-1")).toEqual({ view: "projects" });
    expect(routeFromPath("/policies?id=policy-1")).toEqual({ view: "projects" });
    expect(routeFromPath("/actions?id=build")).toEqual({ view: "projects" });
    expect(routeFromPath("/loop?id=delivery")).toEqual({ view: "projects" });
    expect(routeFromPath("/automation/runtimes?id=codex")).toEqual({ view: "projects" });
    expect(routeFromPath("/agent-runs?id=run-1")).toEqual({ view: "projects" });
  });

  it("builds encoded paths", () => {
    expect(projectDocumentPath(".ballet/goals/a b.md")).toBe("/projects/document?path=.ballet%2Fgoals%2Fa%20b.md");
    expect(projectCollectionDocumentPath("project 1", "goal", ".ballet/goals/a b.md")).toBe("/projects/project%201/goals?path=.ballet%2Fgoals%2Fa%20b.md");
    expect(projectCollectionDocumentPath("project 1", "adr", ".ballet/adr/a b.md")).toBe("/projects/project%201/adrs?path=.ballet%2Fadr%2Fa%20b.md");
    expect(projectCollectionDocumentPath("project 1", "instruction", ".ballet/instructions/a b.md")).toBe("/projects/project%201/instructions?path=.ballet%2Finstructions%2Fa%20b.md");
    expect(agentDocumentPath(".codex/agents/a b.toml")).toBe("/agents?path=.codex%2Fagents%2Fa%20b.toml");
    expect(skillDocumentPath(".agents/skills/a/SKILL.md")).toBe("/skills?path=.agents%2Fskills%2Fa%2FSKILL.md");
    expect(automationAllLoopsPath()).toBe("/automation/loops?view=all");
    expect(automationLoopPath("wf 1")).toBe("/automation/loops?id=wf+1");
    expect(runOverviewPath("root 1")).toBe("/run?run=root%201");
    expect(runLoopPath("wf 1", "root 1")).toBe("/run/loops/wf%201?run=root%201");
    expect(runAgentPath("agent 1", "root 1")).toBe("/run/agents/agent%201?run=root%201");
    expect(runtimePath("runtime 1")).toBe("/runtimes?id=runtime%201");
  });
});
