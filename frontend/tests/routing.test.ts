import { describe, expect, it } from "vitest";
import {
  automationGraphNodePath, automationGraphPath, automationJobNodePath,
  routeFromPath, runGraphNodePath, runGraphPath, runOverviewPath
} from "../src/workspace/routing";

describe("canonical Graph Engineering routing", () => {
  it("parses exactly the three engineering levels", () => {
    expect(routeFromPath("/automation/graph")).toEqual({
      view: "automation", engineeringLevel: "graph"
    });
    expect(routeFromPath("/automation/graph/nodes/build")).toEqual({
      view: "automation", engineeringLevel: "graph_node", graphNodeId: "build"
    });
    expect(routeFromPath("/automation/graph/nodes/build/jobs/backend%20implementation")).toEqual({
      view: "automation", engineeringLevel: "job_node",
      graphNodeId: "build", jobNodeId: "backend implementation"
    });
  });

  it("rejects Loop, Workflow and query aliases", () => {
    expect(routeFromPath("/automation/loops")).toEqual({ view: "projects" });
    expect(routeFromPath("/automation/graph?view=workflow&id=build")).toEqual({
      view: "automation", engineeringLevel: "graph"
    });
    expect(routeFromPath("/run/loops/build")).toEqual({ view: "projects" });
  });

  it("parses Graph and GraphNode Run routes", () => {
    expect(routeFromPath("/run")).toEqual({ view: "run", rootRunId: undefined });
    expect(routeFromPath("/run/graphs/graph%20engineering?run=root-1")).toEqual({
      view: "run", runTargetKind: "graph", runTargetId: "graph engineering", rootRunId: "root-1"
    });
    expect(routeFromPath("/run/graph-nodes/build?run=root-2")).toEqual({
      view: "run", runTargetKind: "graph_node", runTargetId: "build", rootRunId: "root-2"
    });
  });

  it("builds encoded canonical paths", () => {
    expect(automationGraphPath()).toBe("/automation/graph");
    expect(automationGraphNodePath("build one")).toBe("/automation/graph/nodes/build%20one");
    expect(automationJobNodePath("build one", "job two"))
      .toBe("/automation/graph/nodes/build%20one/jobs/job%20two");
    expect(runOverviewPath("root 1")).toBe("/run?run=root%201");
    expect(runGraphPath("graph one", "root 1")).toBe("/run/graphs/graph%20one?run=root%201");
    expect(runGraphNodePath("build one", "root 1"))
      .toBe("/run/graph-nodes/build%20one?run=root%201");
  });
});
