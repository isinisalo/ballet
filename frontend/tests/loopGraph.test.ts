import type { ProjectAction } from "@shared/api/workspace-contracts";
import { describe, expect, it } from "vitest";
import { buildLoopGraph, loopFoldedRecords, loopInputEventLabel, loopOutputEvents } from "../src/workspace/automation/loops/loopGraph";

const loopId = "delivery.loop";

const action = (patch: Partial<ProjectAction>): ProjectAction => ({
  id: patch.id ?? "action",
  description: patch.description ?? "",
  ...(patch.agentId ? { agentId: patch.agentId } : {})
});

describe("loop graph", () => {
  it("groups routed action targets under the latest parent output event", () => {
    const parent = action({ id: "parent" });
    const child = action({ id: "child" });
    const graph = buildLoopGraph([
      {
        actionId: parent.id,
        index: 0,
        loopId,
        action: parent,
        outputTargets: [{
          outputId: "rejected",
          eventType: "delivery.loop.parent.rejected",
          type: "action",
          targetLoopId: loopId,
          targetActionId: child.id
        }]
      },
      { actionId: child.id, index: 1, loopId, action: child, outputEvents: ["delivery.loop.child.approved"] }
    ]);

    expect(graph.rootRecords.map((record) => record.actionId)).toEqual(["parent"]);
    expect(graph.childRecordsByParentEvent.get("0:delivery.loop.parent.rejected")?.map((record) => record.actionId)).toEqual(["child"]);
  });

  it("indexes every existing routed action target by output event", () => {
    const source = action({ id: "source" });
    const first = action({ id: "first-handler" });
    const second = action({ id: "second-handler" });
    const graph = buildLoopGraph([
      {
        actionId: source.id,
        index: 0,
        loopId,
        action: source,
        outputTargets: [{
          outputId: "approved",
          eventType: "delivery.loop.source.approved",
          type: "action",
          targetLoopId: loopId,
          targetActionId: first.id
        }, {
          outputId: "approved",
          eventType: "delivery.loop.source.approved",
          type: "action",
          targetLoopId: loopId,
          targetActionId: second.id
        }]
      },
      { actionId: first.id, index: 1, loopId, action: first },
      { actionId: second.id, index: 2, loopId, action: second }
    ]);

    expect(graph.eventHandlerRecordsByEvent.get("delivery.loop.source.approved")?.map((record) => record.actionId)).toEqual([
      "first-handler",
      "second-handler"
    ]);
  });

  it("keeps the first loop action as root and labels actions by id", () => {
    const currentAction = action({ id: "manual-start" });
    expect(loopInputEventLabel(currentAction)).toBe("manual-start");
    expect(loopOutputEvents(undefined)).toEqual(["Missing action"]);
    expect(buildLoopGraph([{ actionId: "orphan", index: 0 }]).rootRecords).toEqual([{ actionId: "orphan", index: 0 }]);
  });

  it("groups repeated action records by action id for folded visualization", () => {
    const build = action({ id: "build" });
    const review = action({ id: "review" });
    const records = [
      { actionId: build.id, index: 0, loopId, action: build, outputEvents: ["delivery.loop.build.approved"] },
      { actionId: review.id, index: 1, loopId, action: review, outputEvents: ["delivery.loop.review.rejected"] },
      { actionId: build.id, index: 2, loopId, action: build, outputEvents: ["delivery.loop.build.ready"] }
    ];
    const graph = buildLoopGraph(records);

    expect(graph.actionFoldModel.canonicalIndexByRecordIndex.get(2)).toBe(0);
    expect(graph.actionFoldModel.canonicalRecordByIndex.get(2)?.actionId).toBe("build");
    expect(loopFoldedRecords(graph, records[0]!).map((record) => record.actionId)).toEqual([
      "build",
      "build"
    ]);
  });
});
