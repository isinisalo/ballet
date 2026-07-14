import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "../../shared/domain/agents.js";
import { defaultTerminalNodes, type ProjectAutomationConfig } from "../../shared/domain/automation.js";
import {
  AutomationConflictError,
  loadProjectAutomationConfigWithIssues,
  saveProjectAutomationConfig,
  validateProjectAutomationConfig
} from "../automation.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { MarkdownStore } from "../store.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("agent removal", () => {
  it("does not delete an agent or its runtime configuration while automation references it", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ballet-agent-removal-"));
    roots.push(root);
    await mkdir(path.join(root, ".ballet"), { recursive: true });
    await mkdir(path.join(root, ".codex", "agents"), { recursive: true });
    const agentPath = path.join(root, ".codex", "agents", "reviewer.toml");
    await writeFile(agentPath, "name = \"Reviewer\"\nenabled = true\ndeveloper_instructions = \"Review.\"\n");
    await writeFile(path.join(root, ".ballet", "project.json"), JSON.stringify({ ...automation(), agents: {} }));
    const database = new RuntimeDatabase(path.join(root, "state.sqlite"));
    const store = new MarkdownStore(root, database);
    const removeConfiguration = vi.fn();
    store.setAgentRemovalHook(removeConfiguration);

    await expect(store.remove("agents", "reviewer")).rejects.toBeInstanceOf(AutomationConflictError);

    expect(await readFile(agentPath, "utf8")).toContain("Reviewer");
    expect(removeConfiguration).not.toHaveBeenCalled();
    await expect(access(agentPath)).resolves.toBeUndefined();
    database.close();
  });

  it("validates an explicit empty agent set without hiding the source config", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ballet-agent-integrity-"));
    roots.push(root);
    const config = automation();
    await saveProjectAutomationConfig(root, config, [agent]);

    const loaded = await loadProjectAutomationConfigWithIssues(root, []);

    expect(validateProjectAutomationConfig(config, [])).toContainEqual(expect.objectContaining({
      path: "loops.0.nodes.0.agentId"
    }));
    expect(validateProjectAutomationConfig(config, [])).toContainEqual(expect.objectContaining({
      path: "loops.1.nodes.0.agentId"
    }));
    expect(loaded.config.loops).toEqual(config.loops);
    expect(loaded.issues).toContainEqual(expect.objectContaining({ path: "loops.0.nodes.0.agentId" }));
  });
});

const agent: Agent = {
  id: "reviewer", name: "Reviewer", description: "Reviews.", instructions: "Review.", skills: [], enabled: true,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
};

const automation = (): ProjectAutomationConfig => ({
  version: 8,
  loops: [{
    id: "delivery", start: "review", summaryStyle: "route",
    nodes: [{
      id: "review", type: "agent", agentId: "reviewer", description: "Review.", nodeStyle: "luna", nodeSize: "tiny",
      on: { approved: "completed", rejected: "failed" }
    }, ...defaultTerminalNodes()]
  }, {
    id: "scheduled-delivery",
    start: "scheduled-review",
    summaryStyle: "route",
    nodes: [{
      id: "scheduled-review",
      type: "scheduled",
      agentId: "reviewer",
      description: "Review on schedule.",
      nodeStyle: "luna",
      nodeSize: "tiny",
      schedule: { kind: "once", date: "2026-07-15", time: "09:00", timeZone: "UTC" },
      on: { approved: "completed", rejected: "blocked" }
    }, ...defaultTerminalNodes()]
  }]
});
