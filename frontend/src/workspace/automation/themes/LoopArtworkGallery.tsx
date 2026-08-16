import {
  loopNodeSizeCatalog,
  loopNodeStyles,
  loopNodeStyleCatalog,
  type LoopNodeSize,
  type LoopNodeStyle,
  type LoopTheme,
  type ProjectWorkLoopNode
} from "@shared/api/workspace-contracts";
import { LoopCompositeNode } from "../loops/LoopCompositeNode";
import type { LoopNodeContext } from "../loops/LoopCanvasTypes";
import { LoopRouteArtwork } from "../loops/LoopRouteArtwork";
import type { LoopNodeRecord } from "../loops/loopGraph";
import { loopThemeCssProperties } from "../loops/loopTheme";

const galleryGroups = [
  { id: "classic", label: "Classic" },
  { id: "planet", label: "Planets" }
] as const;

const allSizes = ["tiny", "small", "medium", "large"] as const;

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
          <h3 className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Loop summary</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3">
            <div className="grid min-w-0 justify-items-center gap-1 text-center" data-loop-route-preview>
              <LoopRouteArtwork size={24} />
              <span className="font-mono text-[0.62rem] leading-4 text-muted-foreground">Route</span>
            </div>
          </div>
        </section>
        {galleryGroups.map((group) => {
          const styles = loopNodeStyles.filter((style) => loopNodeStyleCatalog[style].group === group.id);
          return (
            <section key={group.id} data-loop-artwork-gallery-group={group.id} className="grid gap-3">
              <h3 className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{group.label}</h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-x-3 gap-y-7">
                {styles.map((style, index) => {
                  const size = gallerySize(index);
                  const pixels = loopNodeSizeCatalog[size].pixels;
                  return (
                    <div key={style} className="grid min-w-0 justify-items-center gap-1 pb-5" data-loop-artwork-preview={style} data-loop-artwork-preview-size={size}>
                      <div className="relative" style={{ width: pixels, height: pixels }}>
                        <LoopCompositeNode context={context} record={galleryRecord(style, size, index)} />
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

function gallerySize(index: number): LoopNodeSize {
  return allSizes[index % allSizes.length];
}

function galleryRecord(nodeStyle: LoopNodeStyle, nodeSize: LoopNodeSize, index: number): LoopNodeRecord {
  const id = `preview-${nodeStyle}`;
  const definition: ProjectWorkLoopNode = {
    id,
    description: loopNodeStyleCatalog[nodeStyle].label,
    work: {
      type: "agent",
      task: "Preview work",
      executionProfileId: "codex-gpt-5-6-sol-medium-network-off",
      primaryInstructionId: "project:theme-preview",
      skillIds: [],
      nodeStyle,
      nodeSize
    },
    validation: { type: "human", task: "Preview validation", nodeStyle, nodeSize },
    maxLocalAttempts: 3
  };
  return {
    nodeKey: id,
    index,
    loopId: "theme-preview",
    outputTargets: [],
    node: {
      id,
      displayId: loopNodeStyleCatalog[nodeStyle].label,
      description: definition.description,
      terminal: false,
      nodeStyle,
      nodeSize,
      definition
    }
  };
}

function galleryContext(theme: LoopTheme): LoopNodeContext {
  return {
    selectedLoopId: "theme-preview",
    theme,
    nodeByKey: new Map(),
    draggedNodeIndex: null,
    dragOverNodeIndex: null,
    selectedNodeIndexes: [],
    readOnly: true,
    staticPreview: true,
    canAddFirstNode: false,
    onNodePointerDown: () => undefined,
    onNodePointerMove: () => undefined,
    onNodePointerUp: () => false,
    onNodePointerCancel: () => undefined,
    onNodeSelect: () => undefined,
    onOutputHandlerSelect: () => undefined,
    onAddFirstNode: () => undefined
  };
}
