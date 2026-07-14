import {
  loopNodeSizeCatalog,
  loopNodeStyles,
  loopNodeStyleCatalog,
  loopSummaryStyleCatalog,
  loopSummaryStyles,
  type LoopNodeSize,
  type LoopNodeStyle,
  type LoopTheme,
  type ProjectLoopNode
} from "@shared/api/workspace-contracts";
import { LoopCompactStepNode } from "../loops/LoopCompactStepNode";
import type { LoopNodeContext } from "../loops/LoopCanvasTypes";
import { LoopSummaryArtwork } from "../loops/LoopSummaryArtwork";
import type { LoopStepRecord } from "../loops/loopGraph";
import { loopThemeCssProperties } from "../loops/loopTheme";

const galleryGroups = [
  { id: "classic", label: "Classic" },
  { id: "planet", label: "Planets & stations" },
  { id: "ship", label: "Ships · Tiny / Small" },
  { id: "monster", label: "Monsters" }
] as const;

const allSizes = ["tiny", "small", "medium", "large"] as const;
const compactSizes = ["tiny", "small"] as const;

export function LoopArtworkGallery({ theme }: { theme: LoopTheme }) {
  const context = galleryContext(theme);
  return (
    <section
      aria-label="Node artwork catalog"
      className="h-[360px] overflow-y-auto rounded-lg border border-divider-strong bg-background p-3"
      style={loopThemeCssProperties(theme)}
    >
      <div className="grid gap-5">
        <section data-loop-artwork-gallery-group="loop-summary" className="grid gap-3">
          <h3 className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Loop summaries</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3">
            {loopSummaryStyles.map((summaryStyle) => (
              <div
                key={summaryStyle}
                className="grid min-w-0 justify-items-center gap-1 text-center"
                data-loop-summary-preview={summaryStyle}
              >
                <LoopSummaryArtwork summaryStyle={summaryStyle} size={24} />
                <span className="font-mono text-[0.62rem] leading-4 text-muted-foreground">
                  {loopSummaryStyleCatalog[summaryStyle].label}
                </span>
              </div>
            ))}
          </div>
        </section>
        {galleryGroups.map((group) => {
          const styles = loopNodeStyles.filter((style) => loopNodeStyleCatalog[style].group === group.id);
          return (
            <section key={group.id} data-loop-artwork-gallery-group={group.id} className="grid gap-3">
              <h3 className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{group.label}</h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-x-3 gap-y-7">
                {styles.map((style, index) => {
                  const size = gallerySize(style, index);
                  const pixels = loopNodeSizeCatalog[size].pixels;
                  return (
                    <div key={style} className="grid min-w-0 justify-items-center gap-1 pb-5" data-loop-artwork-preview={style} data-loop-artwork-preview-size={size}>
                      <div className="relative" style={{ width: pixels, height: pixels }}>
                        <LoopCompactStepNode context={context} record={galleryRecord(style, size, index)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function gallerySize(style: LoopNodeStyle, index: number): LoopNodeSize {
  return loopNodeStyleCatalog[style].group === "ship"
    ? compactSizes[index % compactSizes.length]
    : allSizes[index % allSizes.length];
}

function galleryRecord(nodeStyle: LoopNodeStyle, nodeSize: LoopNodeSize, index: number): LoopStepRecord {
  const id = `preview-${nodeStyle}`;
  const step: ProjectLoopNode = {
    id,
    type: "agent",
    agentId: "preview-agent",
    description: loopNodeStyleCatalog[nodeStyle].label,
    nodeStyle,
    nodeSize,
    on: { approved: "completed", rejected: "blocked" }
  };
  return {
    stepKey: id,
    index,
    loopId: "theme-preview",
    outputTargets: [],
    step: {
      id,
      displayId: loopNodeStyleCatalog[nodeStyle].label,
      description: step.description,
      agentId: "preview-agent",
      humanGate: false,
      scheduled: false,
      terminal: false,
      nodeStyle,
      nodeSize,
      step
    }
  };
}

function galleryContext(theme: LoopTheme): LoopNodeContext {
  return {
    selectedLoopId: "theme-preview",
    theme,
    stepByKey: new Map(),
    draggedStepIndex: null,
    dragOverStepIndex: null,
    selectedStepIndexes: [],
    readOnly: true,
    staticPreview: true,
    canAddFirstStep: false,
    onStepPointerDown: () => undefined,
    onStepPointerMove: () => undefined,
    onStepPointerUp: () => false,
    onStepPointerCancel: () => undefined,
    onStepSelect: () => undefined,
    onOutputHandlerSelect: () => undefined,
    onAddFirstStep: () => undefined
  };
}
