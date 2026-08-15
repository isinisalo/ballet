import type {
  ExecutionProfile,
  LoopNodeSize,
  LoopNodeStyle,
  ProjectAutomationConfig,
  ProjectWorkLoopNode,
  ProjectWorkNode
} from "@shared/api/workspace-contracts";
import { calculateCompositeLoopCanvasLayout } from "../loops/loopLayout";
import { buildLoopVisualProjection } from "../loops/loopVisualProjection";

export const previewLoopId = "theme-preview";
const profileId = "codex-gpt-5-6-sol-medium-network-off";
const instructionId = "project:theme-preview";
const appearance = (nodeStyle: LoopNodeStyle, nodeSize: LoopNodeSize) => ({ nodeStyle, nodeSize });
const providerWork = (task: string, nodeStyle: LoopNodeStyle, nodeSize: LoopNodeSize): ProjectWorkNode => ({
  type: "agent",
  task,
  executionProfileId: profileId,
  primaryInstructionId: instructionId,
  skillIds: [],
  ...appearance(nodeStyle, nodeSize)
});
const node = (id: string, work: ProjectWorkNode): ProjectWorkLoopNode => ({
  id,
  description: `${id} preview node`,
  work,
  validation: { type: "human", task: `Validate ${id}`, ...appearance("luna", "tiny") },
  maxLocalAttempts: 3
});

const previewConfig: ProjectAutomationConfig = {
  version: 10,
  orchestrator: {
    executionProfileId: profileId,
    primaryInstructionId: instructionId,
    skillIds: [],
    maxRepairDepth: 4,
    maxRepairAttempts: 3
  },
  loops: [{
    id: previewLoopId,
    description: "Theme preview Work Loop.",
    state: { description: "Theme preview state.", initial: {} },
    startNodeId: "luna",
    nodes: [
      node("luna", {
        type: "scheduled",
        task: "Tiny Luna schedule",
        executionProfileId: profileId,
        primaryInstructionId: instructionId,
        skillIds: [],
        schedule: { kind: "recurring", cadence: "weekdays", startsOn: "2026-07-13", time: "09:00", timeZone: "Europe/Helsinki" },
        ...appearance("luna", "tiny")
      }),
      node("flat", providerWork("Medium Flat", "flat", "medium")),
      node("terra", { type: "human", task: "Medium Terra", ...appearance("terra", "medium") }),
      node("sol", { type: "human", task: "Large Sol", ...appearance("sol", "large") })
    ],
    edges: [
      { id: "luna-ok", source: "luna", target: { nodeId: "flat" } },
      { id: "flat-ok", source: "flat", target: { nodeId: "terra" } },
      { id: "terra-ok", source: "terra", target: { nodeId: "sol" } },
      { id: "sol-ok", source: "sol", target: { terminal: "completed" } }
    ]
  }],
  loopEdges: []
};

const previewExecutionProfiles = [{
  id: profileId,
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
