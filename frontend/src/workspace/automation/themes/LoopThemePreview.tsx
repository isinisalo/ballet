import { useRef } from "react";
import type { Agent, LoopTheme, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { LoopCanvasSurface } from "../loops/LoopCanvasSurface";
import { calculateCompositeLoopCanvasLayout } from "../loops/loopLayout";
import { buildLoopVisualProjection } from "../loops/loopVisualProjection";

const previewLoopId = "theme-preview";
const previewConfig: ProjectAutomationConfig = {
  version: 7,
  loops: [{
    id: previewLoopId,
    start: "luna",
    steps: [{
      id: "luna",
      type: "scheduled",
      agentId: "preview-agent",
      nodeStyle: "luna",
      description: "Tiny Luna schedule",
      schedule: { kind: "recurring", cadence: "weekdays", startsOn: "2026-07-13", time: "09:00", timeZone: "Europe/Helsinki" },
      on: { approved: "black-hole", rejected: { end: "blocked" } }
    }, {
      id: "black-hole",
      type: "agent",
      agentId: "preview-agent",
      nodeStyle: "black-hole",
      description: "Tiny Black hole",
      on: { approved: "satellite", rejected: { end: "failed" } }
    }, {
      id: "satellite",
      type: "human",
      nodeStyle: "satellite",
      description: "Tiny Satellite",
      on: { approved: "meteorite", rejected: { end: "completed" } }
    }, {
      id: "meteorite",
      type: "agent",
      agentId: "preview-agent",
      nodeStyle: "meteorite",
      description: "Tiny Meteorite",
      on: { approved: "spaceman", rejected: { end: "blocked" } }
    }, {
      id: "spaceman",
      type: "human",
      nodeStyle: "spaceman",
      description: "Tiny Spaceman",
      on: { approved: "mars", rejected: { end: "failed" } }
    }, {
      id: "mars",
      type: "agent",
      agentId: "preview-agent",
      nodeStyle: "mars",
      description: "Small Mars",
      on: { approved: "flat", rejected: { end: "blocked" } }
    }, {
      id: "flat",
      type: "human",
      nodeStyle: "flat",
      description: "Medium Flat",
      on: { approved: "terra", rejected: { end: "failed" } }
    }, {
      id: "terra",
      type: "agent",
      agentId: "preview-agent",
      nodeStyle: "terra",
      description: "Medium Terra",
      on: { approved: "sol", rejected: { end: "blocked" } }
    }, {
      id: "sol",
      type: "human",
      nodeStyle: "sol",
      description: "Large Sol",
      on: { approved: { loop: "downstream-loop" }, rejected: { end: "failed" } }
    }]
  }, {
    id: "downstream-loop",
    start: "downstream-step",
    steps: [{
      id: "downstream-step",
      type: "human",
      nodeStyle: "flat",
      description: "Cross-Loop destination",
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
      canvasHeight={360}
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
