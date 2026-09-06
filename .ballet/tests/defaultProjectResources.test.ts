import { parseAdr } from "../../shared/orchestration/adr.js";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { parse as parseToml } from "smol-toml";
import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { UserStoryService } from "../../backend/orchestration/project/UserStoryService.js";
import { ProjectDocumentRepository } from "../../backend/orchestration/project/ProjectDocumentRepository.js";
import { validateRunnableEnvironment } from "../../shared/orchestration/gates.js";
import { projectConfigurationV26Schema } from "../../shared/orchestration/schemas/environmentSchemas.js";

const root = path.resolve(import.meta.dirname, "../..");

const load = (relative: string) => JSON.parse(readFileSync(path.join(root, relative), "utf8"));
const walk = (directory: string): string[] => readdirSync(directory).flatMap((entry) => {
  const target = path.join(directory, entry);
  return statSync(target).isDirectory() ? walk(target) : [target];
});

describe("canonical default project resources", () => {
  test("loads the exact runnable four-State 18-Action lifecycle without project-definition config copies", () => {
    const project = projectConfigurationV26Schema.parse(load(".ballet/project.json"));
    expect(project.environment.states.map(({ order }) => order).sort((left, right) => left - right)).toEqual([1, 2, 3, 4]);
    // Authoring may reorder States; verify the resource inventory independently of serialized order.
    const states = ["arc42", "design", "build", "deploy"].map((id) => project.environment.states.find((state) => state.id === id)!);
    expect(states.map(({ id, name }) => [id, name])).toEqual([
      ["arc42", "Arc42"], ["design", "Design"], ["build", "Build"], ["deploy", "Deploy"]
    ]);
    expect(states.map(({ actions }) => actions.map(({ id }) => id))).toEqual([
      ["arc42-introduction-goals", "arc42-constraints", "arc42-context-scope", "arc42-solution-strategy",
        "arc42-building-block-view", "arc42-runtime-view", "arc42-deployment-view", "arc42-crosscutting-concepts",
        "arc42-architectural-decisions", "arc42-quality-requirements", "arc42-risks-technical-debt", "arc42-glossary"],
      ["design-wireframes", "design-reusable-components"],
      ["build-write-tests", "build-write-code"],
      ["deploy-to-dev", "deploy-acceptance-test"]
    ]);
    const actions = project.environment.states.flatMap(({ actions }) => actions);
    expect(actions).toHaveLength(18);
    expect(actions.every(({ id, input, validation, work }) => input !== undefined
      && validation.agentId === `ballet-action-validation-${id}` && validation.skillResources.length > 0
      && work.agentId === `ballet-action-work-${id}` && work.skillResources.length > 0)).toBe(true);
    expect(actions.find(({ id }) => id === "deploy-to-dev")?.maxRetries).toBe(0);
    expect(validateRunnableEnvironment(project.environment)).toEqual([]);
  });

  test("retains original bytes and approval provenance while converted stories remain unapproved", () => {
    const archive = load(".ballet/history/project-definition-2026-09-06/manifest.json");
    for (const file of archive.files) {
      const bytes = readFileSync(path.join(root, file.archived));
      expect(createHash("sha256").update(bytes).digest("hex"), file.source).toBe(file.sha256);
    }
    const collection = new UserStoryService(new ProjectDocumentRepository(path.join(root, ".ballet")), () => undefined).list();
    expect(collection.issues).toEqual([]); expect(collection.stories.length).toBeGreaterThanOrEqual(8);
    const trace = readFileSync(path.join(root, ".ballet/arc42/TRACEABILITY.md"), "utf8");
    for (const { value } of collection.stories) {
      expect(value.status).toBe("draft"); expect(value.approvalRevision).toBe(0); expect(value.approval).toBeUndefined();
      expect(trace).toContain(value.id); expect(value.acceptanceCriteria.length).toBeGreaterThan(0);
      for (const id of value.adrIds) expect(readdirSync(path.join(root, ".ballet/adr")).some((file) => parseAdr(readFileSync(path.join(root, `.ballet/adr/${file}`), "utf8")).id === id), id).toBe(true);
    }
    for (const source of Object.values(archive.destinations) as string[]) expect(existsSync(path.join(root, source.split("#")[0]!))).toBe(true);
    expect(Object.keys(archive.destinations)).toHaveLength(13);
    const config = load(".ballet/project.json");
    expect(config).not.toHaveProperty("direction"); expect(config).not.toHaveProperty("overview");
    for (const removed of ["goals", "constraints", "use-cases"]) expect(existsSync(path.join(root, ".ballet", removed))).toBe(false);
    for (const section of ["Purpose", "Outcomes", "Scope", "Shared requirements"]) expect(readFileSync(path.join(root, ".ballet/overview.md"), "utf8")).toContain(`## ${section}`);
  });

  test("resolves every selected Action Agent and shared Skill with no orphan runtime resource", () => {
    const project = projectConfigurationV26Schema.parse(load(".ballet/project.json"));
    const actionRoles = project.environment.states.flatMap((state) => state.actions.flatMap((action) => [action.validation, action.work]));
    const agentIds = new Set(actionRoles.map(({ agentId }) => agentId));
    const skillIds = new Set([project.critic.agent, project.refinement.agent, ...actionRoles].flatMap(({ skillResources }) => skillResources));
    const instructions = [...agentIds].map((id) => {
      const filename = path.join(root, ".codex/agents", `${id}.toml`); expect(existsSync(filename), id).toBe(true);
      const agent = parseToml(readFileSync(filename, "utf8"));
      expect(Object.keys(agent).sort()).toEqual(["description", "developer_instructions", "model", "model_reasoning_effort", "name"]);
      expect(agent).toMatchObject({ name: id, model: "gpt-5.6-sol", model_reasoning_effort: "high" });
      return String(agent.developer_instructions);
    });
    expect(new Set(instructions).size).toBe(36);
    for (const state of project.environment.states) for (const action of state.actions) {
      for (const role of ["validation", "work"] as const) {
        const id = action[role].agentId;
        const agent = parseToml(readFileSync(path.join(root, ".codex", "agents", `${id}.toml`), "utf8"));
        const instruction = String(agent.developer_instructions);
        expect(instruction, id).toContain(action.id); expect(instruction, id).toContain(action.name);
        expect(instruction, id).toContain("Objective:"); expect(instruction, id).toMatch(/sources|source material/i);
        expect(instruction, id).toMatch(/deliverables|Produce these Action-specific deliverables/i);
        expect(instruction, id).toMatch(/acceptance checks/i);
        if (role === "validation") expect(instruction).toMatch(/done.*delegate.*blocked/s);
        else expect(instruction).toContain("completed or needs_input");
      }
    }
    for (const id of skillIds) expect(existsSync(path.join(root, ".agents/skills", id, "SKILL.md")), id).toBe(true);
    expect(readdirSync(path.join(root, ".codex", "agents")).filter((file) => file.startsWith("ballet-action-") && file.endsWith(".toml")).map((file) => path.basename(file, ".toml")).sort()).toEqual([...agentIds].sort());
    expect(walk(path.join(root, ".agents/skills")).filter((file) => file.endsWith("SKILL.md")).map((file) => path.relative(path.join(root, ".agents/skills"), path.dirname(file))).sort())
      .toEqual([...skillIds].sort());
  });

  test("uses two governance and 36 Action Codex TOML Agents with a disabled valid Critic schedule", () => {
    const project = projectConfigurationV26Schema.parse(load(".ballet/project.json"));
    for (const [id, effort] of [["ballet-critic-agent", "low"], ["ballet-refinement-agent", "high"]] as const) {
      const agent = parseToml(readFileSync(path.join(root, ".codex", "agents", `${id}.toml`), "utf8"));
      expect(agent).toMatchObject({ name: id, model: "gpt-5.6-sol", model_reasoning_effort: effort, sandbox_mode: "read-only" });
      expect(String(agent.developer_instructions)).toContain("## Task");
    }
    expect(readdirSync(path.join(root, ".codex", "agents")).filter((file) => file.endsWith(".toml"))).toHaveLength(38);
    expect(project.critic.enabled).toBe(false);
    expect(project.critic.schedules).toEqual([{ id: "weekday-quality-review", kind: "weekly", timeZone: "Europe/Helsinki", localTimes: ["09:00"], weekdays: [1, 3, 5] }]);
  });

  test("loads the compact fixture as a runnable two-State multi-Action project", () => {
    const fixture = projectConfigurationV26Schema.parse(load(".fixture-ballet-project/.ballet/project.json"));
    expect(fixture.environment.states).toHaveLength(2);
    expect(fixture.environment.states.flatMap(({ actions }) => actions)).toHaveLength(3);
    expect(new UserStoryService(new ProjectDocumentRepository(path.join(root, ".fixture-ballet-project/.ballet")), () => undefined).list().stories).toHaveLength(2);
    expect(validateRunnableEnvironment(fixture.environment)).toEqual([]);
    expect(fixture.critic.enabled).toBe(false);
    expect(fixture.critic.schedules).toHaveLength(1);
    expect(readdirSync(path.join(root, ".fixture-ballet-project", ".codex", "agents")).filter((file) => file.endsWith(".toml"))).toHaveLength(8);
  });

  test("keeps the editable drawio source well formed and canonical", () => {
    const filename = path.join(root, "ballet.drawio");
    expect(() => execFileSync("xmllint", ["--noout", filename], { stdio: "pipe" })).not.toThrow();
    const source = readFileSync(filename, "utf8");
    for (const label of ["Human direction", "User Stories", "Ordered States", "Priority Actions", "Validation main", "Work subordinate", "Feedback Box", "Critic proposal", "Refinement proposal", "Continuation Run", "Run Evidence"]) expect(source).toContain(label);
    for (const removed of ["RewardMDP", "GraphNode", "ActionNode", "acceptance_ledger", "policy_decision"]) expect(source).not.toContain(removed);
  });
});
