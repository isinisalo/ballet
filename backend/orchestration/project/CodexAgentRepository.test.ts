import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CodexAgentRepository } from "./CodexAgentRepository.js";
import { ActionAgentMutationService } from "./ActionAgentMutationService.js";
import { ProjectConfigurationRepository } from "./ProjectConfigurationRepository.js";
import { ProjectDefinitionService } from "./ProjectDefinitionService.js";
import { ProjectDocumentRepository } from "./ProjectDocumentRepository.js";
import { LocalDatabase } from "../persistence/LocalDatabase.js";
import { EnvironmentRunStore } from "../persistence/EnvironmentRunStore.js";
import { environmentSeed } from "../persistence/PersistenceTestFixtures.js";
import { validProjectConfig } from "../testing/ProjectFixtures.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("fixed Codex Agent TOML repository", () => {
  test("exposes exactly two fixed slots and reports missing files without creating them", () => {
    const root = createRoot(); const repository = new CodexAgentRepository(root);
    writeAgent(root, "ballet-critic-agent", "low");
    expect(repository.list().map(({ id, status }) => [id, status])).toEqual([
      ["ballet-critic-agent", "ready"], ["ballet-refinement-agent", "missing"]
    ]);
  });

  test("rejects wrong identity, unsupported settings, sandbox changes, and symlinks", () => {
    const root = createRoot(); const filename = writeAgent(root, "ballet-critic-agent", "low");
    const repository = new CodexAgentRepository(root);
    writeFileSync(filename, source("ballet-refinement-agent", "low"));
    expect(repository.inspect("ballet-critic-agent").status).toBe("invalid");
    writeFileSync(filename, source("ballet-critic-agent", "minimal"));
    expect(repository.inspect("ballet-critic-agent").status).toBe("invalid");
    writeFileSync(filename, source("ballet-critic-agent", "low").replace('sandbox_mode = "read-only"', 'sandbox_mode = "workspace-write"'));
    expect(repository.inspect("ballet-critic-agent").status).toBe("invalid");
    rmSync(filename); const target = path.join(root, "agent-target.toml"); writeFileSync(target, source("ballet-critic-agent", "low"));
    symlinkSync(target, filename); expect(repository.inspect("ballet-critic-agent")).toMatchObject({ status: "invalid" });
  });

  test("rejects a symlinked .codex parent even when the fixed file itself is ordinary", () => {
    const root = createRoot();
    const external = mkdtempSync(path.join(tmpdir(), "ballet-agent-external-")); roots.push(external);
    mkdirSync(path.join(external, "agents"));
    writeFileSync(path.join(external, "agents", "ballet-critic-agent.toml"), source("ballet-critic-agent", "low"));
    rmSync(path.join(root, ".codex"), { recursive: true });
    symlinkSync(external, path.join(root, ".codex"));
    expect(new CodexAgentRepository(root).inspect("ballet-critic-agent")).toMatchObject({ status: "invalid" });
  });

  test("uses an optimistic content hash and preserves fixed TOML fields", () => {
    const root = createRoot(); writeAgent(root, "ballet-critic-agent", "low"); const repository = new CodexAgentRepository(root);
    const before = repository.require("ballet-critic-agent");
    expect(() => repository.put("ballet-critic-agent", { developerInstructions: "Changed", model: "gpt-5.6-sol",
      reasoningEffort: "high", expectedHash: "f".repeat(64) })).toThrow(/stale/);
    const saved = repository.put("ballet-critic-agent", { developerInstructions: "Changed", model: "gpt-5.6-sol",
      reasoningEffort: "high", expectedHash: before.contentHash });
    expect(saved.agent).toMatchObject({ id: "ballet-critic-agent", name: "ballet-critic-agent",
      developerInstructions: "Changed", reasoningEffort: "high", sandboxMode: "read-only" });
  });

  test("requires an exact, ordinary, schema-valid Action Agent inventory with unique instructions", () => {
    const root = createRoot(); const repository = new CodexAgentRepository(root);
    const validation = "ballet-action-validation-action-1"; const work = "ballet-action-work-action-1";
    writeActionAgent(root, validation, "Validate action-1 evidence.");
    writeActionAgent(root, work, "Implement action-1 delegation.");
    expect(repository.requireActionSet([validation, work]).map(({ id }) => id)).toEqual([validation, work]);

    writeActionAgent(root, work, "Validate action-1 evidence.");
    expect(() => repository.requireActionSet([validation, work])).toThrow(/unique developer instructions/);
    writeActionAgent(root, work, "Implement action-1 delegation.");
    writeActionAgent(root, "ballet-action-work-extra", "Implement extra action.");
    expect(() => repository.requireActionSet([validation, work])).toThrow(/Extra: ballet-action-work-extra/);
    rmSync(path.join(root, ".codex", "agents", "ballet-action-work-extra.toml"));

    const filename = path.join(root, ".codex", "agents", `${validation}.toml`);
    writeFileSync(filename, actionSource(work, "Wrong identity."));
    expect(repository.inspectAction(validation).status).toBe("invalid");
    writeFileSync(filename, `${actionSource(validation, "Validate action-1 evidence.")}sandbox_mode = "read-only"\n`);
    expect(repository.inspectAction(validation).status).toBe("invalid");
    writeFileSync(filename, actionSource(validation, "Validate action-1 evidence.").replace("gpt-5.6-sol", "unsupported-model"));
    expect(repository.inspectAction(validation).status).toBe("invalid");
    writeFileSync(filename, actionSource(validation, "Validate action-1 evidence.").replace('model_reasoning_effort = "high"', 'model_reasoning_effort = "minimal"'));
    expect(repository.inspectAction(validation).status).toBe("invalid");
    rmSync(filename); const target = path.join(root, "action-agent-target.toml");
    writeFileSync(target, actionSource(validation, "Validate action-1 evidence.")); symlinkSync(target, filename);
    expect(repository.inspectAction(validation).status).toBe("invalid");
  });

  test("updates the Action config and its Agent pair atomically, rejects stale hashes, and locks active Runs", () => {
    const root = createRoot(); mkdirSync(path.join(root, ".ballet"), { recursive: true });
    const database = new LocalDatabase(path.join(root, "state.sqlite")); const connection = () => database.connection(); connection();
    const projects = new ProjectConfigurationRepository(path.join(root, ".ballet", "project.json"), connection);
    const loaded = projects.save(validProjectConfig(), "absent"); const agents = new CodexAgentRepository(root);
    const validationId = "ballet-action-validation-action-1"; const workId = "ballet-action-work-action-1";
    writeActionAgent(root, validationId, "Validate original action-1 evidence.");
    writeActionAgent(root, workId, "Implement original action-1 delegation.");
    const validation = agents.requireAction(validationId); const work = agents.requireAction(workId);
    const service = new ActionAgentMutationService(projects, agents); const action = validProjectConfig().environment.states[0]!.actions[0]!;
    const update = { ...action, description: "Changed Action" };
    const authoring = {
      validationAgent: { description: validation.agent.description, developerInstructions: "Validate changed action-1 evidence.",
        model: validation.agent.model, reasoningEffort: validation.agent.reasoningEffort, expectedDocumentHash: validation.contentHash },
      workAgent: { description: work.agent.description, developerInstructions: "Implement changed action-1 delegation.",
        model: work.agent.model, reasoningEffort: work.agent.reasoningEffort, expectedDocumentHash: work.contentHash }
    };
    const originalPut = agents.putAction.bind(agents);
    vi.spyOn(agents, "putAction").mockImplementation((id, input) => {
      if (id === workId) throw new Error("simulated paired TOML failure");
      return originalPut(id, input);
    });
    expect(() => service.updateAction("state-1", update, authoring, loaded.configHash)).toThrow("simulated paired TOML failure");
    expect(projects.load().configHash).toBe(loaded.configHash);
    expect(agents.requireAction(validationId).contentHash).toBe(validation.contentHash);
    expect(agents.requireAction(workId).contentHash).toBe(work.contentHash);
    vi.restoreAllMocks();
    expect(() => service.updateAction("state-1", update, authoring, "f".repeat(64))).toThrow(/Project Config optimistic hash is stale/);
    new EnvironmentRunStore(connection).create(environmentSeed());
    expect(() => service.updateAction("state-1", update, authoring, loaded.configHash)).toThrow(/locked/);
    database.close();
  });

  test("rolls Project Config back when the TOML update fails and locks active Runs", () => {
    const root = createRoot(); writeAgent(root, "ballet-critic-agent", "low"); writeAgent(root, "ballet-refinement-agent", "high");
    mkdirSync(path.join(root, ".ballet"), { recursive: true });
    const database = new LocalDatabase(path.join(root, "state.sqlite")); const connection = () => database.connection(); connection();
    const projects = new ProjectConfigurationRepository(path.join(root, ".ballet", "project.json"), connection);
    const loaded = projects.save(validProjectConfig(), "absent");
    const service = new ProjectDefinitionService(root, projects, new ProjectDocumentRepository(path.join(root, ".ballet"), connection));
    const slot = service.agents.require("ballet-critic-agent");
    vi.spyOn(service.agents, "put").mockImplementation(() => { throw new Error("simulated TOML failure"); });
    expect(() => service.putAgent({ id: "ballet-critic-agent", developerInstructions: "Changed", model: "gpt-5.6-sol",
      reasoningEffort: "low", skillResources: ["new-skill"], expectedConfigHash: loaded.configHash,
      expectedDocumentHash: slot.contentHash })).toThrow("simulated TOML failure");
    expect(projects.load().configHash).toBe(loaded.configHash);
    vi.restoreAllMocks(); new EnvironmentRunStore(connection).create(environmentSeed());
    expect(() => service.putAgent({ id: "ballet-critic-agent", developerInstructions: "Changed", model: "gpt-5.6-sol",
      reasoningEffort: "low", skillResources: [], expectedConfigHash: loaded.configHash,
      expectedDocumentHash: slot.contentHash })).toThrow(/locked/);
    database.close();
  });
});

const createRoot = () => { const root = mkdtempSync(path.join(tmpdir(), "ballet-codex-agent-")); roots.push(root);
  mkdirSync(path.join(root, ".codex", "agents"), { recursive: true }); return root; };
const writeAgent = (root: string, id: "ballet-critic-agent" | "ballet-refinement-agent", effort: "low" | "high") => {
  const filename = path.join(root, ".codex", "agents", `${id}.toml`); writeFileSync(filename, source(id, effort)); return filename;
};
const source = (name: string, effort: string) => `name = "${name}"\ndescription = "Test Agent"\nmodel = "gpt-5.6-sol"\nmodel_reasoning_effort = "${effort}"\nsandbox_mode = "read-only"\ndeveloper_instructions = "Inspect evidence."\n`;
const actionSource = (name: string, instructions: string) => `name = "${name}"\ndescription = "Action Agent"\ndeveloper_instructions = "${instructions}"\nmodel = "gpt-5.6-sol"\nmodel_reasoning_effort = "high"\n`;
const writeActionAgent = (root: string, id: string, instructions: string) => {
  const filename = path.join(root, ".codex", "agents", `${id}.toml`); writeFileSync(filename, actionSource(id, instructions)); return filename;
};
