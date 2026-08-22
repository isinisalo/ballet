import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { projectConfigSchema } from "../../shared/api/workspace-schemas.js";

describe("project configuration v14 strict cut", () => {
  it("accepts the repository GraphNode aggregate", async () => {
    const parsed = projectConfigSchema.parse(JSON.parse(await readFile(".ballet/project.json", "utf8")));
    expect(parsed.version).toBe(14);
    expect(parsed.graph.graphNodes).toHaveLength(5);
    expect(parsed.graph.graphNodes.flatMap(({ jobNodes }) => jobNodes)).toHaveLength(17);
  });

  it.each([
    ["loops", { loops: [] }],
    ["startLoopId", { startLoopId: "design" }],
    ["transitions", { transitions: [] }],
    ["repairEdges", { repairEdges: [] }],
    ["edges", { edges: [] }],
    ["passEdges", { passEdges: [] }],
    ["failEdges", { failEdges: [] }],
    ["schedule", { schedule: { cron: "* * * * *" } }]
  ])("rejects legacy field %s", async (_name, legacy) => {
    const value = JSON.parse(await readFile(".ballet/project.json", "utf8")) as Record<string, unknown>;
    const candidate = "loops" in legacy ? { ...value, ...legacy }
      : { ...value, graph: { ...(value.graph as object), ...legacy } };
    expect(projectConfigSchema.safeParse(candidate).success).toBe(false);
  });

  it("rejects every earlier configuration version", async () => {
    const value = JSON.parse(await readFile(".ballet/project.json", "utf8")) as Record<string, unknown>;
    for (const version of [13, 12, 1, 0]) {
      expect(projectConfigSchema.safeParse({ ...value, version }).success).toBe(false);
    }
  });

  it("rejects an orphan Job child and unreachable terminals", async () => {
    const value = projectConfigSchema.parse(JSON.parse(await readFile(".ballet/project.json", "utf8")));
    const broken = structuredClone(value);
    broken.graph.graphNodes[0].orchestrator.routing.start.candidates = [
      { target: { terminal: "PASS" }, description: "Only PASS" }
    ];
    broken.graph.graphNodes[0].orchestrator.routing.continuation = [];
    expect(projectConfigSchema.safeParse(broken).success).toBe(false);
  });

  it("requires explicit valid profile and instruction mappings", async () => {
    const value = projectConfigSchema.parse(JSON.parse(await readFile(".ballet/project.json", "utf8")));
    const broken = structuredClone(value);
    broken.graph.orchestrator.executionProfileId = "";
    broken.graph.orchestrator.primaryInstructionId = "";
    expect(projectConfigSchema.safeParse(broken).success).toBe(false);
  });
});
