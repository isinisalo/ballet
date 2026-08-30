import type { CSSProperties } from "react";
import type { ActionArtwork } from "./loopEngineeringProjection";

export function ActionPlanetArtwork({ artwork, size }: { artwork: ActionArtwork; size: number }) {
  const style = { "--action-planet-size": `${size}px` } as CSSProperties;
  return <span className={`loop-engineering-planet loop-engineering-planet--${artwork}`} style={style} aria-hidden="true" />;
}
