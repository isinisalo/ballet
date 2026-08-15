import { useRef } from "react";
import type { LoopTheme } from "@shared/api/workspace-contracts";
import { LoopCanvasSurface } from "../loops/LoopCanvasSurface";
import { LoopArtworkGallery } from "./LoopArtworkGallery";
import { previewLayout, previewLoopId, previewProjection } from "./loopThemePreviewModel";

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
