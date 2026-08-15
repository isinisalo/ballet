import type { ExecutionProfile, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { calculateCompositeLoopCanvasLayout } from "../loops/loopLayout";
import { buildLoopVisualProjection } from "../loops/loopVisualProjection";

export const previewLoopId = "theme-preview";
const previewExecutionProfileId = "codex-gpt-5-6-sol-medium-network-off";
const previewPrimaryInstructionId = "project:theme-preview";
const previewConfig: ProjectAutomationConfig = {
  version: 9,
  loops: [{
    id: previewLoopId,
    start: "luna",
    nodes: [{
      id: "luna",
      type: "scheduled",
      executionProfileId: previewExecutionProfileId,
      primaryInstructionId: previewPrimaryInstructionId,
      skillIds: [],
      nodeStyle: "luna",
      nodeSize: "tiny",
      description: "Tiny Luna schedule",
      schedule: { kind: "recurring", cadence: "weekdays", startsOn: "2026-07-13", time: "09:00", timeZone: "Europe/Helsinki" },
      on: { approved: "flat", rejected: "failed" }
    }, {
      id: "flat",
      type: "agent",
      executionProfileId: previewExecutionProfileId,
      primaryInstructionId: previewPrimaryInstructionId,
      skillIds: [],
      nodeStyle: "flat",
      nodeSize: "medium",
      description: "Medium Flat",
      on: { approved: "terra", rejected: "blocked" }
    }, {
      id: "terra",
      type: "human",
      nodeStyle: "terra",
      nodeSize: "medium",
      description: "Medium Terra",
      on: { approved: "sol", rejected: "completed" }
    }, {
      id: "sol",
      type: "human",
      nodeStyle: "sol",
      nodeSize: "large",
      description: "Large Sol",
      on: { approved: { loop: "downstream-loop" }, rejected: "failed" }
    }, {
      id: "completed",
      type: "completed",
      nodeStyle: "flat",
      nodeSize: "tiny",
      description: "Completed terminal"
    }, {
      id: "blocked",
      type: "blocked",
      nodeStyle: "luna",
      nodeSize: "tiny",
      description: "Blocked terminal"
    }, {
      id: "failed",
      type: "failed",
      nodeStyle: "vector-planet",
      nodeSize: "tiny",
      description: "Failed terminal"
    }]
  }, {
    id: "downstream-loop",
    start: "downstream-step",
    nodes: [{
      id: "downstream-step",
      type: "human",
      nodeStyle: "flat",
      nodeSize: "medium",
      description: "Cross-Loop destination",
      on: { approved: "completed", rejected: "blocked" }
    }, {
      id: "completed",
      type: "completed",
      nodeStyle: "flat",
      nodeSize: "tiny",
      description: ""
    }, {
      id: "blocked",
      type: "blocked",
      nodeStyle: "flat",
      nodeSize: "tiny",
      description: ""
    }, {
      id: "failed",
      type: "failed",
      nodeStyle: "flat",
      nodeSize: "tiny",
      description: ""
    }]
  }]
};

const previewExecutionProfiles = [{
  id: previewExecutionProfileId,
  name: "Codex GPT-5.6 Sol · Medium · Network off",
  provider: "codex",
  model: "gpt-5.6-sol",
  reasoningEffort: "medium",
  networkAccess: false
}] satisfies ExecutionProfile[];

const previewLoop = previewConfig.loops[0]!;
export const previewProjection = buildLoopVisualProjection(previewConfig, previewLoop, undefined, previewExecutionProfiles);
export const previewLayout = calculateCompositeLoopCanvasLayout({
  config: previewProjection.config,
  selectedLoopId: previewLoopId,
  recordsByLoopId: previewProjection.recordsByLoopId,
  direction: "horizontal"
});
