import { useRef } from "react";
import type { Agent, LoopTheme, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { defaultAgentStepTransitions, gotoTransition } from "@shared/api/workspace-contracts";
import { LoopCanvasSurface } from "../loops/LoopCanvasSurface";
import { calculateCompositeLoopCanvasLayout } from "../loops/loopLayout";
import { buildLoopVisualProjection } from "../loops/loopVisualProjection";
import { LoopArtworkGallery } from "./LoopArtworkGallery";

const previewLoopId = "theme-preview";
const previewConfig: ProjectAutomationConfig = {
  version: 8,
  loops: [{
    id: previewLoopId,
    start: "luna",
    nodes: [{
      id: "luna",
      type: "scheduled",
      agentId: "preview-agent",
      nodeStyle: "luna",
      nodeSize: "tiny",
      description: "Tiny Luna schedule",
      schedule: { kind: "recurring", cadence: "weekdays", startsOn: "2026-07-13", time: "09:00", timeZone: "Europe/Helsinki" },
      on: { ...defaultAgentStepTransitions(), ready: gotoTransition("flat"), approved: gotoTransition("flat"), needs_input: gotoTransition("terra") }
    }, {
      id: "flat",
      type: "agent",
      agentId: "preview-agent",
      nodeStyle: "flat",
      nodeSize: "medium",
      description: "Medium Flat",
      on: { ...defaultAgentStepTransitions(), ready: gotoTransition("terra"), approved: gotoTransition("terra"), needs_input: gotoTransition("terra") }
    }, {
      id: "terra",
      type: "human",
      nodeStyle: "terra",
      nodeSize: "medium",
      description: "Medium Terra",
      on: { approved: gotoTransition("sol"), rejected: gotoTransition("completed") }
    }, {
      id: "sol",
      type: "human",
      nodeStyle: "sol",
      nodeSize: "large",
      description: "Large Sol",
      on: { approved: gotoTransition({ loop: "downstream-loop" }), rejected: gotoTransition("failed") }
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
      on: { approved: gotoTransition("completed"), rejected: gotoTransition("blocked") }
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
    <div className="grid gap-3 xl:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.1fr)]">
      <LoopArtworkGallery theme={theme} />
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
        canvasHeight={360}
        isCanvasPanning={false}
        loopCanvasRef={canvasRef}
        canAddFirstStep={false}
        onStepPointerDown={() => undefined}
        onStepPointerMove={() => undefined}
        onStepPointerUp={() => false}
        onStepPointerCancel={() => undefined}
        onCanvasMoveStart={() => undefined}
        onCanvasMoveEnd={() => undefined}
        onStepSelect={() => undefined}
        onOutputHandlerSelect={() => undefined}
        onAddFirstStep={() => undefined}
      />
    </div>
  );
}
