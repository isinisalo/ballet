import { readFileSync, readdirSync } from "node:fs";
import { parse } from "smol-toml";
import { expect, test } from "vitest";
import { projectConfigurationV26Schema } from "../../shared/orchestration/schemas/environmentSchemas.js";
import { EventStormingContextService } from "../../backend/orchestration/project/EventStormingContextService.js";
const selected = ["arc42-introduction-goals", "arc42-context-scope", "arc42-glossary", "design-wireframes", "design-reusable-components", "build-write-tests", "build-write-code", "deploy-acceptance-test"];
test("actual Action compositions bind bounded context instructions to both agent roles without a modeling gate", () => {
  const config = projectConfigurationV26Schema.parse(JSON.parse(readFileSync(".ballet/project.json", "utf8")));
  const actions = config.environment.states.flatMap((s) => s.actions);
  expect(config.environment.states.some((s) => s.id === "event-storming")).toBe(false);
  expect(actions.some((a) => a.id.startsWith("event-storming-"))).toBe(false);
  expect(readdirSync(".codex/agents").some((f) => f.includes("-event-storming-"))).toBe(false);
  for (const id of selected) for (const role of ["validation", "work"] as const) {
    const action = actions.find((a) => a.id === id)!; expect(action[role].skillResources).toContain("event-storming");
    const agent = parse(readFileSync(`.codex/agents/${action[role].agentId}.toml`, "utf8"));
    expect(agent.model).toBe("gpt-5.6-sol"); expect(agent.model_reasoning_effort).toBe("high");
    const text = String(agent.developer_instructions);
    expect(text).toContain("Action.input.eventStormingTarget"); expect(text).toContain("ballet context event-storming --process <id> --json");
    expect(text).toContain("Work must read it"); expect(text).toContain("postwork must reread it");
    expect(text).not.toContain("model.md"); expect(text).not.toContain("previous level");
  }
  const index = new EventStormingContextService(process.cwd()).read(); expect(index.kind).toBe("index");
  expect(JSON.stringify(index)).not.toContain("acceptanceCriteria");
  const skill = readFileSync(".agents/skills/event-storming/SKILL.md", "utf8");
  expect(skill).toContain("source hashes"); expect(skill).toContain("not a Run gate"); expect(skill).toContain("Never approve stories");
});
