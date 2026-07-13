import { describe, expect, it } from "vitest";
import {
  agentCreatePath,
  agentDocumentPath,
  automationAllLoopsPath,
  automationLoopPath,
  automationNewThemePath,
  automationThemeLibraryPath,
  automationThemePath,
  projectCollectionCreatePath,
  projectCollectionDocumentPath,
  projectDocumentPath,
  routeFromPath,
  runAgentPath,
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
    expect(routeFromPath("/agents")).toEqual({ view: "agents" });
    expect(routeFromPath("/agents?new=1")).toEqual({ view: "agents", creating: true });
    expect(routeFromPath("/skills?new=1")).toEqual({ view: "skills", creating: true });
    expect(routeFromPath("/skills?new=1&path=.agents%2Fskills%2Freview%2FSKILL.md")).toEqual({
      view: "skills",
      documentPath: ".agents/skills/review/SKILL.md"
    });
    expect(routeFromPath("/automation/loops?id=build")).toEqual({ view: "automation", automationEntityId: "build" });
    expect(routeFromPath("/automation/outputs?id=artifact")).toEqual({ view: "projects" });
    expect(routeFromPath("/automation/loops?view=all")).toEqual({
      view: "automation",
      automationLoopView: "all"
    });
    expect(routeFromPath("/automation/gates?id=gate-1")).toEqual({ view: "projects" });
    expect(routeFromPath("/automation/themes")).toEqual({ view: "loop-theme-library" });
    expect(routeFromPath("/automation/themes?id=open-ai&loop=release%20train")).toEqual({
      view: "loop-theme",
      loopThemeId: "open-ai",
      loopThemeSourceId: undefined,
      loopThemeLoopId: "release train"
    });
    expect(routeFromPath("/automation/themes?newFrom=open-ai&loop=release%20train")).toEqual({
      view: "loop-theme",
      loopThemeId: undefined,
      loopThemeSourceId: "open-ai",
      loopThemeLoopId: "release train"
    });
    expect(routeFromPath("/runtimes?id=ignored-local-device")).toEqual({ view: "runtimes" });
  });

  it("parses URL-backed Ballet Run routes", () => {
    expect(routeFromPath("/run")).toEqual({ view: "run", rootRunId: undefined });
    expect(routeFromPath("/run/loops/release%20train?run=root-1")).toEqual({ view: "run", runTargetKind: "loop", runTargetId: "release train", rootRunId: "root-1" });
    expect(routeFromPath("/run/agents/reviewer?run=root-2")).toEqual({ view: "run", runTargetKind: "agent", runTargetId: "reviewer", rootRunId: "root-2" });
  });

  it("does not keep legacy automation route aliases", () => {
    expect(routeFromPath("/automation/policies?id=policy-1")).toEqual({ view: "projects" });
  });

  it("builds encoded paths", () => {
    expect(projectDocumentPath(".ballet/goals/a b.md")).toBe("/project/document?path=.ballet%2Fgoals%2Fa%20b.md");
    expect(projectCollectionDocumentPath("goal", ".ballet/goals/a b.md")).toBe("/project/goals?path=.ballet%2Fgoals%2Fa%20b.md");
    expect(projectCollectionDocumentPath("adr", ".ballet/adr/a b.md")).toBe("/project/adrs?path=.ballet%2Fadr%2Fa%20b.md");
    expect(projectCollectionDocumentPath("instruction", ".ballet/instructions/a b.md")).toBe("/project/instructions?path=.ballet%2Finstructions%2Fa%20b.md");
    expect(projectCollectionCreatePath("adr")).toBe("/project/adrs?new=1");
    expect(projectCollectionCreatePath("goal")).toBe("/project/goals?new=1");
    expect(projectCollectionCreatePath("instruction")).toBe("/project/instructions?new=1");
    expect(agentDocumentPath(".codex/agents/a b.toml")).toBe("/agents?path=.codex%2Fagents%2Fa%20b.toml");
    expect(agentCreatePath()).toBe("/agents?new=1");
    expect(skillDocumentPath(".agents/skills/a/SKILL.md")).toBe("/skills?path=.agents%2Fskills%2Fa%2FSKILL.md");
    expect(skillCreatePath()).toBe("/skills?new=1");
    expect(automationAllLoopsPath()).toBe("/automation/loops?view=all");
    expect(automationLoopPath("wf 1")).toBe("/automation/loops?id=wf+1");
    expect(automationThemeLibraryPath()).toBe("/automation/themes");
    expect(automationThemePath("theme 1")).toBe("/automation/themes?id=theme+1");
    expect(automationThemePath("theme 1", "wf 1")).toBe("/automation/themes?id=theme+1&loop=wf+1");
    expect(automationNewThemePath("theme 1", "wf 1")).toBe("/automation/themes?newFrom=theme+1&loop=wf+1");
    expect(runOverviewPath("root 1")).toBe("/run?run=root%201");
    expect(runLoopPath("wf 1", "root 1")).toBe("/run/loops/wf%201?run=root%201");
    expect(runAgentPath("agent 1", "root 1")).toBe("/run/agents/agent%201?run=root%201");
    expect(runtimePath()).toBe("/runtimes");
  });
});
