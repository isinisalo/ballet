import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { projectConfigReadinessSchema, projectConfigSchema } from "../../shared/api/workspace-schemas.js";

describe("project configuration v16 Port A contract", () => {
  it("accepts the repository agent_v1 pilot baseline as structurally and operationally valid", async () => {
    const source = JSON.parse(await readFile(".ballet/project.json", "utf8"));
    const parsed = projectConfigSchema.parse(source);
    expect(parsed.version).toBe(16);
    expect(parsed.graph.graphNodes).toHaveLength(5);
    expect(parsed.graph.graphNodes.flatMap(({ jobNodes }) => jobNodes)).toHaveLength(17);
    expect(projectConfigReadinessSchema.safeParse(source).success).toBe(true);
  });

  it.each([
    ["loops", { loops: [] }], ["startLoopId", { startLoopId: "design" }], ["transitions", { transitions: [] }],
    ["repairEdges", { repairEdges: [] }], ["edges", { edges: [] }], ["passEdges", { passEdges: [] }],
    ["failEdges", { failEdges: [] }], ["schedule", { schedule: { cron: "* * * * *" } }]
  ])("rejects legacy field %s", async (_name, legacy) => {
    const value = JSON.parse(await readFile(".ballet/project.json", "utf8")) as Record<string, unknown>;
    const candidate = "loops" in legacy ? { ...value, ...legacy } : { ...value, graph: { ...(value.graph as object), ...legacy } };
    expect(projectConfigSchema.safeParse(candidate).success).toBe(false);
  });

  it("rejects every earlier configuration version without migration", async () => {
    const value = JSON.parse(await readFile(".ballet/project.json", "utf8")) as Record<string, unknown>;
    for (const version of [15, 14, 13, 1, 0]) expect(projectConfigSchema.safeParse({ ...value, version }).success).toBe(false);
  });

  it("rejects an orphan Job child and unreachable terminals in local agent routing", async () => {
    const value = projectConfigSchema.parse(JSON.parse(await readFile(".ballet/project.json", "utf8")));
    const broken = structuredClone(value); const strategy = broken.graph.graphNodes[0]!.strategy;
    if (strategy.kind !== "agent_v1") throw new Error("Expected agent fixture.");
    strategy.orchestrator.routing.start.candidates = [{ target: { terminal: "PASS" }, description: "Only PASS" }];
    strategy.orchestrator.routing.continuation = [];
    expect(projectConfigReadinessSchema.safeParse(broken).success).toBe(false);
  });

  it("requires explicit valid profile mappings", async () => {
    const value = projectConfigSchema.parse(JSON.parse(await readFile(".ballet/project.json", "utf8")));
    const broken = structuredClone(value);
    if (broken.graph.strategy.kind !== "agent_v1") throw new Error("Expected agent fixture.");
    broken.graph.strategy.orchestrator.executionProfileId = "";
    expect(projectConfigReadinessSchema.safeParse(broken).success).toBe(false);
  });
});
