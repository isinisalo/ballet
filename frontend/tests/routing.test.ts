import { describe, expect, it } from "vitest";
import {
  automationCreateLoopPath,
  automationGraphPath,
  automationLoopPath,
  automationThemePath,
  executionProfileCreatePath,
  executionProfilePath,
  projectCollectionCreatePath,
  projectCollectionDocumentPath,
  projectDocumentPath,
  routeFromPath,
  runLoopPath,
  runOverviewPath,
  runtimePath,
  skillCreatePath,
  skillDocumentPath
} from "../src/workspace/routing";

describe("workspace routing", () => {
  it("parses project document and collection routes", () => {
    expect(routeFromPath("/project/document?path=.ballet%2Fgoals%2Fone.md")).toEqual({
      view: "project-document",
      documentPath: ".ballet/goals/one.md"
    });
    expect(routeFromPath("/project/goals")).toEqual({ view: "project-goals" });
    expect(routeFromPath("/project/goals?new=1")).toEqual({ view: "project-goals", creating: true });
    expect(routeFromPath("/project/goals?path=.ballet%2Fgoals%2Fone.md")).toEqual({
      view: "project-goals",
      documentPath: ".ballet/goals/one.md"
    });
    expect(routeFromPath("/project/adrs")).toEqual({ view: "project-adrs" });
    expect(routeFromPath("/project/adrs?path=.ballet%2Fadr%2Fdecision.md")).toEqual({
      view: "project-adrs",
      documentPath: ".ballet/adr/decision.md"
    });
    expect(routeFromPath("/project/instructions")).toEqual({ view: "project-instructions" });
    expect(routeFromPath("/project/instructions?path=.ballet%2Finstructions%2Freviewer.md")).toEqual({
      view: "project-instructions",
      documentPath: ".ballet/instructions/reviewer.md"
    });
    expect(routeFromPath("/project/adrs?new=1&path=.ballet%2Fadr%2Fdecision.md")).toEqual({
      view: "project-adrs",
      documentPath: ".ballet/adr/decision.md"
    });
  });

  it("parses canonical automation and runtime routes with selected entities", () => {
    expect(routeFromPath("/execution-profiles")).toEqual({
      view: "execution-profiles",
      executionProfileId: undefined,
      creating: undefined
    });
    expect(routeFromPath("/execution-profiles?id=reviewer")).toEqual({
      view: "execution-profiles",
      executionProfileId: "reviewer",
      creating: undefined
    });
    expect(routeFromPath("/execution-profiles?new=1")).toEqual({
      view: "execution-profiles",
      executionProfileId: undefined,
      creating: true
    });
    expect(routeFromPath("/skills?new=1")).toEqual({ view: "skills", creating: true });
    expect(routeFromPath("/skills?new=1&path=.agents%2Fskills%2Freview%2FSKILL.md")).toEqual({
      view: "skills",
      documentPath: ".agents/skills/review/SKILL.md"
    });
    expect(routeFromPath("/automation/loops")).toEqual({ view: "automation", automationView: "graph" });
    expect(routeFromPath("/automation/loops?view=graph")).toEqual({ view: "automation", automationView: "graph" });
    expect(routeFromPath("/automation/loops?view=graph&id=build")).toEqual({ view: "automation", automationView: "graph", automationRouteIssue: "non-canonical-graph" });
    expect(routeFromPath("/automation/loops?view=workflow&id=build")).toEqual({ view: "automation", automationView: "workflow", automationEntityId: "build", creating: undefined, automationRouteIssue: undefined });
    expect(routeFromPath("/automation/loops?view=workflow&new=1")).toEqual({ view: "automation", automationView: "workflow", automationEntityId: undefined, creating: true, automationRouteIssue: undefined });
    expect(routeFromPath("/automation/loops?view=workflow")).toEqual({ view: "automation", automationView: "workflow", automationEntityId: undefined, creating: undefined, automationRouteIssue: "missing-loop-id" });
    expect(routeFromPath("/automation/loops?view=loop&id=build")).toEqual({ view: "automation", automationRouteIssue: "invalid-view" });
    expect(routeFromPath("/automation/loops?view=invalid&id=build")).toEqual({ view: "automation", automationRouteIssue: "invalid-view" });
    expect(routeFromPath("/automation/loops?level=context")).toEqual({ view: "automation", automationRouteIssue: "invalid-view" });
    expect(routeFromPath("/automation/loops?level=1&id=build")).toEqual({ view: "automation", automationRouteIssue: "invalid-view" });
    expect(routeFromPath("/automation/loops?level=2&id=build")).toEqual({ view: "automation", automationRouteIssue: "invalid-view" });
    expect(routeFromPath("/automation/loops?view=all")).toEqual({ view: "automation", automationRouteIssue: "invalid-view" });
    expect(routeFromPath("/automation/outputs?id=artifact")).toEqual({ view: "projects" });
    expect(routeFromPath("/automation/gates?id=gate-1")).toEqual({ view: "projects" });
    expect(routeFromPath("/automation/theme")).toEqual({ view: "loop-theme" });
    expect(routeFromPath("/runtimes?id=ignored-local-device")).toEqual({ view: "runtimes" });
  });

  it("parses URL-backed Ballet Run routes", () => {
    expect(routeFromPath("/run")).toEqual({ view: "run", rootRunId: undefined });
    expect(routeFromPath("/run/loops/release%20train?run=root-1")).toEqual({ view: "run", runTargetKind: "loop", runTargetId: "release train", rootRunId: "root-1" });
    expect(routeFromPath("/run/agents/reviewer?run=root-2")).toEqual({ view: "projects" });
  });

  it("does not keep legacy automation route aliases", () => {
    expect(routeFromPath("/automation/policies?id=policy-1")).toEqual({ view: "projects" });
    expect(routeFromPath("/automation/themes?id=open-ai")).toEqual({ view: "projects" });
  });

  it("builds encoded paths", () => {
    expect(projectDocumentPath(".ballet/goals/a b.md")).toBe("/project/document?path=.ballet%2Fgoals%2Fa%20b.md");
    expect(projectCollectionDocumentPath("goal", ".ballet/goals/a b.md")).toBe("/project/goals?path=.ballet%2Fgoals%2Fa%20b.md");
    expect(projectCollectionDocumentPath("adr", ".ballet/adr/a b.md")).toBe("/project/adrs?path=.ballet%2Fadr%2Fa%20b.md");
    expect(projectCollectionDocumentPath("instruction", ".ballet/instructions/a b.md")).toBe("/project/instructions?path=.ballet%2Finstructions%2Fa%20b.md");
    expect(projectCollectionCreatePath("adr")).toBe("/project/adrs?new=1");
    expect(projectCollectionCreatePath("goal")).toBe("/project/goals?new=1");
    expect(projectCollectionCreatePath("instruction")).toBe("/project/instructions?new=1");
    expect(executionProfilePath("profile one")).toBe("/execution-profiles?id=profile%20one");
    expect(executionProfilePath()).toBe("/execution-profiles");
    expect(executionProfileCreatePath()).toBe("/execution-profiles?new=1");
    expect(skillDocumentPath(".agents/skills/a/SKILL.md")).toBe("/skills?path=.agents%2Fskills%2Fa%2FSKILL.md");
    expect(skillCreatePath()).toBe("/skills?new=1");
    expect(automationGraphPath()).toBe("/automation/loops?view=graph");
    expect(automationLoopPath("wf 1")).toBe("/automation/loops?view=workflow&id=wf+1");
    expect(automationCreateLoopPath()).toBe("/automation/loops?view=workflow&new=1");
    expect(automationThemePath()).toBe("/automation/theme");
    expect(runOverviewPath("root 1")).toBe("/run?run=root%201");
    expect(runLoopPath("wf 1", "root 1")).toBe("/run/loops/wf%201?run=root%201");
    expect(runtimePath()).toBe("/runtimes");
  });
});
