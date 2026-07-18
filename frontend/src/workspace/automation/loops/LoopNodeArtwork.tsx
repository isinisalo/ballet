import type { ComponentType } from "react";
import { loopNodeStyleCatalog, type LoopNodeStyle } from "@shared/api/workspace-contracts";
import { VectorPlanetArtwork } from "./LoopNodePlanetArtwork";

type LoopNodeArtworkComponent = ComponentType<Record<string, never>>;

const loopNodeArtworkByStyle: Record<LoopNodeStyle, LoopNodeArtworkComponent | null> = {
  flat: null,
  luna: null,
  mars: null,
  terra: null,
  sol: null,
  "vector-planet": VectorPlanetArtwork
};

export function LoopNodeArtwork({ nodeStyle }: { nodeStyle: LoopNodeStyle }) {
  const Artwork = loopNodeArtworkByStyle[nodeStyle];
  const group = loopNodeStyleCatalog[nodeStyle].group;
  return (
    <span
      aria-hidden="true"
      data-loop-node-artwork={nodeStyle}
      className={`loop-node-surface loop-node-surface--group-${group} loop-node-surface--${nodeStyle}`}
    >
      {Artwork ? <Artwork /> : null}
    </span>
  );
}
