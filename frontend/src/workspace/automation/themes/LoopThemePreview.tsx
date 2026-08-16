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
        nodeByKey={previewProjection.nodeByKey}
        draggedNodeIndex={null}
        dragOverNodeIndex={null}
        selectedNodeIndexes={[]}
        readOnly
        staticPreview
        canvasHeight={360}
        isCanvasPanning={false}
        loopCanvasRef={canvasRef}
        canAddFirstNode={false}
        onNodePointerDown={() => undefined}
        onNodePointerMove={() => undefined}
        onNodePointerUp={() => false}
        onNodePointerCancel={() => undefined}
        onCanvasMoveStart={() => undefined}
        onCanvasMoveEnd={() => undefined}
        onNodeSelect={() => undefined}
        onOutputHandlerSelect={() => undefined}
        onAddFirstNode={() => undefined}
      />
    </div>
  );
}
