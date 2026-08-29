import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { describe, expect, test } from "vitest";
import { useCaseApprovalHash } from "../../shared/orchestration/direction.js";
import { validateRunnableEnvironment } from "../../shared/orchestration/gates.js";
import { validateActionInstruction } from "../../shared/orchestration/instructionContract.js";
import { projectConfigurationV20Schema } from "../../shared/orchestration/schemas/environmentSchemas.js";

const root = path.resolve(import.meta.dirname, "../..");

const load = (relative: string) => JSON.parse(readFileSync(path.join(root, relative), "utf8"));
const markdownFrontmatter = (relative: string) => {
  const source = readFileSync(path.join(root, relative), "utf8");
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!block) throw new Error(`${relative} has no frontmatter`);
  return { source, frontmatter: YAML.parse(block[1]!) };
};
const walk = (directory: string): string[] => readdirSync(directory).flatMap((entry) => {
  const target = path.join(directory, entry);
  return statSync(target).isDirectory() ? walk(target) : [target];
});

describe("canonical default project resources", () => {
  test("loads a runnable five-State Environment with 13 exact approved Use Cases", () => {
    const project = projectConfigurationV20Schema.parse(load(".ballet/project.json"));
    expect(project.direction.useCases.map(({ id }) => id)).toEqual(Array.from({ length: 13 }, (_, index) => `UC-${String(index + 1).padStart(2, "0")}`));
    expect(project.direction.useCases.every(({ status }) => status === "approved")).toBe(true);
    expect(project.direction.useCases.every((useCase) => useCase.approval?.contentHash === useCaseApprovalHash(useCase))).toBe(true);
    expect(project.environment.states.map(({ order }) => order)).toEqual([1, 2, 3, 4, 5]);
    expect(project.environment.states.reduce((total, state) => total + state.actions.length, 0)).toBe(14);
    expect(validateRunnableEnvironment(project.environment, project.direction)).toEqual([]);
  });

  test("keeps Use Case documents identical to the approved semantic values and hashes", () => {
    const project = projectConfigurationV20Schema.parse(load(".ballet/project.json"));
    for (const useCase of project.direction.useCases) {
      const document = markdownFrontmatter(`.ballet/use-cases/${useCase.id}.md`);
      expect(document.frontmatter).toMatchObject({ id: useCase.id, title: useCase.name, status: useCase.status, approval: useCase.approval });
      for (const field of ["examples", "successGoals", "failureGoals", "expectedOutcomes", "goalIds", "adrIds", "constraintIds"] as const) {
        expect(document.frontmatter[field]).toEqual(useCase[field]);
      }
      expect(document.frontmatter.approval.contentHash).toBe(useCaseApprovalHash(useCase));
    }
  });

  test("resolves every selected instruction and Skill with no orphan runtime resource", () => {
    const project = projectConfigurationV20Schema.parse(load(".ballet/project.json"));
    const agents = [project.critic.agent, project.refinement.agent,
      ...project.environment.states.flatMap((state) => state.actions.flatMap((action) => [action.validation, action.work]))];
    const instructionIds = new Set(agents.map(({ instructionResource }) => instructionResource));
    const skillIds = new Set(agents.flatMap(({ skillResources }) => skillResources));
    for (const id of instructionIds) {
      const filename = path.join(root, ".ballet/instructions", `${id}.md`);
      expect(existsSync(filename), id).toBe(true);
      expect(validateActionInstruction(readFileSync(filename, "utf8")), id).toEqual([]);
    }
    for (const id of skillIds) expect(existsSync(path.join(root, ".agents/skills", id, "SKILL.md")), id).toBe(true);
    expect(walk(path.join(root, ".ballet/instructions")).filter((file) => file.endsWith(".md")).map((file) => path.basename(file, ".md")).sort())
      .toEqual([...instructionIds].sort());
    expect(walk(path.join(root, ".agents/skills")).filter((file) => file.endsWith("SKILL.md")).map((file) => path.relative(path.join(root, ".agents/skills"), path.dirname(file))).sort())
      .toEqual([...skillIds].sort());
  });

  test("uses explicit network-off Codex profiles and a disabled valid Critic schedule", () => {
    const project = projectConfigurationV20Schema.parse(load(".ballet/project.json"));
    expect(project.executionProfiles).toHaveLength(4);
    expect(project.executionProfiles.every((profile) => profile.provider === "codex" && profile.model === "gpt-5.6-sol"
      && ["high", "xhigh"].includes(profile.reasoningEffort) && !profile.networkAccess)).toBe(true);
    expect(project.critic.enabled).toBe(false);
    expect(project.critic.schedules).toEqual([{ id: "weekday-quality-review", kind: "weekly", timeZone: "Europe/Helsinki", localTimes: ["09:00"], weekdays: [1, 3, 5] }]);
  });

  test("loads the compact fixture as a runnable two-State multi-Action project", () => {
    const fixture = projectConfigurationV20Schema.parse(load(".fixture-ballet-project/.ballet/project.json"));
    expect(fixture.environment.states).toHaveLength(2);
    expect(fixture.environment.states.flatMap(({ actions }) => actions)).toHaveLength(3);
    expect(fixture.direction.useCases).toHaveLength(2);
    expect(validateRunnableEnvironment(fixture.environment, fixture.direction)).toEqual([]);
    expect(fixture.critic.enabled).toBe(false);
    expect(fixture.critic.schedules).toHaveLength(1);
  });

  test("keeps the editable drawio source well formed and canonical", () => {
    const filename = path.join(root, "ballet.drawio");
    expect(() => execFileSync("xmllint", ["--noout", filename], { stdio: "pipe" })).not.toThrow();
    const source = readFileSync(filename, "utf8");
    for (const label of ["Human direction", "Approved Use Cases", "Ordered States", "Priority Actions", "Validation main", "Work subordinate", "Feedback Box", "Critic proposal", "Refinement proposal", "Continuation Run", "Product Snapshot"]) expect(source).toContain(label);
    for (const removed of ["RewardMDP", "GraphNode", "ActionNode", "acceptance_ledger", "policy_decision"]) expect(source).not.toContain(removed);
  });
});
