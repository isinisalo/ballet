import { BriefcaseBusiness, ShieldCheck } from "lucide-react";
import {
  loopNodeSizeCatalog,
  loopNodeStyles,
  loopNodeStyleCatalog,
  type LoopNodeSize,
  type LoopNodeStyle,
  type LoopTheme
} from "@shared/api/workspace-contracts";
import { LoopNodeArtwork } from "../loops/LoopNodeArtwork";
import { LoopRouteArtwork } from "../loops/LoopRouteArtwork";
import { loopThemeCssProperties } from "../loops/loopTheme";

const galleryGroups = [{ id: "classic", label: "Classic" }, { id: "planet", label: "Planets" }] as const;
const allSizes = ["tiny", "small", "medium", "large"] as const;

export function LoopArtworkGallery({ theme }: { theme: LoopTheme }) {
  return (
    <section aria-label="Node artwork catalog" className="h-[360px] overflow-y-auto rounded-lg border border-divider-strong bg-background p-3" style={loopThemeCssProperties(theme)}>
      <div className="grid gap-5">
        <section className="grid gap-3"><h3 className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Graph artwork</h3><div className="grid justify-items-center gap-1 text-center"><LoopRouteArtwork size={24} /><span className="font-mono text-[0.62rem] text-muted-foreground">Route</span></div></section>
        {galleryGroups.map((group) => <section key={group.id} data-loop-artwork-gallery-group={group.id} className="grid gap-3">
          <h3 className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{group.label}</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-x-3 gap-y-7">
            {loopNodeStyles.filter((style) => loopNodeStyleCatalog[style].group === group.id).map((style, index) => <ArtworkPreview key={style} styleName={style} size={gallerySize(index)} />)}
          </div>
        </section>)}
      </div>
    </section>
  );
}

function ArtworkPreview({ styleName, size }: { styleName: LoopNodeStyle; size: LoopNodeSize }) {
  const pixels = loopNodeSizeCatalog[size].pixels;
  return <div className="grid min-w-0 justify-items-center gap-1 pb-5" data-loop-artwork-preview={styleName} data-loop-artwork-preview-size={size}>
    <div role="img" aria-label={`${loopNodeStyleCatalog[styleName].label} Job and Validation artwork`} className="relative" style={{ width: pixels, height: pixels }}>
      <span aria-hidden="true" className="loop-artwork-node absolute inset-0 rounded-full"><LoopNodeArtwork nodeStyle={styleName} /></span>
      <span className="absolute inset-0 grid place-items-center rounded-full border border-primary/50 bg-background/20 text-primary"><BriefcaseBusiness className="size-3" /></span>
      <span className="absolute -right-3 -bottom-3 grid size-5 place-items-center rounded-full border border-secondary/60 bg-background text-secondary"><ShieldCheck className="size-3" /></span>
    </div>
    <span className="font-mono text-[0.6rem] text-muted-foreground">{loopNodeStyleCatalog[styleName].label}</span>
  </div>;
}

function gallerySize(index: number): LoopNodeSize {
  return allSizes[index % allSizes.length];
}
