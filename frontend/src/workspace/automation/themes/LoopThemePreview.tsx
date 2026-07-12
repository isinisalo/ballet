import { useRef } from "react";
import type { Agent, LoopTheme, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { LoopCanvasSurface } from "../loops/LoopCanvasSurface";
import { calculateCompositeLoopCanvasLayout } from "../loops/loopLayout";
import { buildLoopVisualProjection } from "../loops/loopVisualProjection";

const previewLoopId = "theme-preview";
const previewConfig: ProjectAutomationConfig = {
  version: 6,
  loops: [{
    id: previewLoopId,
    theme: "default",
    start: "scheduled-small",
    steps: [{
      id: "scheduled-small",
      type: "scheduled",
      nodeSize: "small",
      description: "Theme preview schedule",
      schedule: { kind: "recurring", cadence: "weekdays", startsOn: "2026-07-13", time: "09:00", timeZone: "Europe/Helsinki" },
      on: { triggered: "agent-medium" }
    }, {
      id: "agent-medium",
      type: "agent",
      agentId: "preview-agent",
      nodeSize: "medium",
      description: "Theme preview agent",
      on: { approved: "human-large", rejected: { end: "blocked" } }
    }, {
      id: "human-large",
      type: "human",
      nodeSize: "large",
      description: "Theme preview gate",
      on: { approved: { loop: "downstream-loop" }, rejected: "agent-medium" }
    }]
  }, {
    id: "downstream-loop",
    theme: "default",
    start: "downstream-step",
    steps: [{
      id: "downstream-step",
      type: "human",
      nodeSize: "small",
      description: "Downstream loop summary",
      on: { approved: { end: "completed" }, rejected: { end: "blocked" } }
    }]
  }]
};

const previewAgent = {
  id: "preview-agent",
  name: "Preview agent",
  description: "Theme preview",
  instructions: "",
  skills: [],
  enabled: true,
  avatar: "rocket",
  createdAt: "2026-07-12T00:00:00.000Z",
  updatedAt: "2026-07-12T00:00:00.000Z"
} satisfies Agent;

const previewLoop = previewConfig.loops[0]!;
const previewProjection = buildLoopVisualProjection(previewConfig, previewLoop, undefined, [previewAgent]);
const previewLayout = calculateCompositeLoopCanvasLayout({
  config: previewProjection.config,
  selectedLoopId: previewLoopId,
  recordsByLoopId: previewProjection.recordsByLoopId,
  direction: "horizontal"
});

export function LoopThemePreview({ theme }: { theme: LoopTheme }) {
  const canvasRef = useRef<HTMLDivElement>(null);

  return (
    <LoopCanvasSurface
      layout={previewLayout}
      theme={theme}
      selectedLoopId={previewLoopId}
      stepByKey={previewProjection.stepByKey}
      draggedStepIndex={null}
      dragOverStepIndex={null}
      selectedStepIndexes={[]}
      readOnly
      staticPreview
      canvasHeight={280}
      isCanvasPanning={false}
      loopCanvasRef={canvasRef}
      canAddFirstStep={false}
      canAddStepForEvent={() => false}
      onStepPointerDown={() => undefined}
      onStepPointerMove={() => undefined}
      onStepPointerUp={() => false}
      onStepPointerCancel={() => undefined}
      onCanvasMoveStart={() => undefined}
      onCanvasMoveEnd={() => undefined}
      onStepSelect={() => undefined}
      onOutputHandlerSelect={() => undefined}
      onAddStep={() => undefined}
    />
  );
}
