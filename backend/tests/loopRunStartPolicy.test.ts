import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AppData } from "../../shared/api/workspace-contracts.js";
import { defaultTerminalNodes, type ProjectLoop } from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import { validateLoopRunStart } from "../services/LoopRunStartPolicy.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const loop = (id: string): ProjectLoop => ({
  id,
  start: "work",
  nodes: [{
    id: "work",
    type: "agent",
    agentId: "worker",
    description: "Work.",
    nodeStyle: "terra",
    nodeSize: "medium",
    on: { approved: "completed", rejected: "blocked" }
  }, ...defaultTerminalNodes()]
});

const data = (projectRoot: string, loopIds: string[]): AppData => ({
  project: {
    id: "fixture", name: "Fixture", description: "Fixture checkout", status: "active",
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
  },
  agents: [],
  skills: [],
  loopRuns: [],
  scheduleStates: [],
  automation: { version: 8, loops: loopIds.map(loop) },
  automationIssues: [],
  loopTheme: structuredClone(defaultLoopTheme),
  loopThemeIssues: [],
  runtime: {
    instanceId: "fixture", hostname: "localhost", platform: "darwin", architecture: "arm64",
    checkout: { path: projectRoot, headSha: "a".repeat(40), configHash: "config", dirty: false },
    uptimeSeconds: 0, startedAt: "2026-01-01T00:00:00.000Z", providers: [], activeRunCount: 0,
    logsPath: path.join(projectRoot, ".git", "ballet", "logs", "ballet.log")
  },
  agentRuntimeConfigurations: {},
  executionStates: [],
  runTargets: { loops: [], agents: [] },
  projectDocumentTree: []
});

const fixtureRoot = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-loop-policy-"));
  roots.push(root);
  return root;
};

describe("loop engineering root-start policy", () => {
  it("allows the blueprint Loop as the only manual root", async () => {
    const root = await fixtureRoot();
    await expect(validateLoopRunStart(data(root, ["blueprint-design"]), "blueprint-design", "Start the project."))
      .resolves.toBeUndefined();
  });

  it.each(["milestone-planning", "milestone-delivery", "release-validation"])(
    "blocks a direct root start of %s",
    async (loopId) => {
      const root = await fixtureRoot();
      await expect(validateLoopRunStart(data(root, [loopId]), loopId, "milestone_id: milestone-001"))
        .rejects.toThrow("can only start from its approved human-gate transition");
    }
  );

  it("blocks another configured Loop from becoming a manual root", async () => {
    const root = await fixtureRoot();
    await expect(validateLoopRunStart(data(root, ["custom-loop"]), "custom-loop"))
      .rejects.toThrow("is not a manual root in the engineering Loop chain");
  });

  it("ignores a missing Loop because the caller reports unknown targets separately", async () => {
    const root = await fixtureRoot();
    await expect(validateLoopRunStart(data(root, []), "missing-loop")).resolves.toBeUndefined();
  });
});
