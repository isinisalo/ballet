import type { CSSProperties } from "react";
import type { ActionArtwork } from "./loopEngineeringProjection";

export function StateRouteArtwork() {
  return <svg viewBox="0 0 24 24" className="loop-engineering-state-artwork" aria-hidden="true" focusable="false">
    <g><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" /></g>
  </svg>;
}

export function ActionPlanetArtwork({ artwork, size }: { artwork: ActionArtwork; size: number }) {
  const style = { "--action-planet-size": `${size}px` } as CSSProperties;
  return <span className={`loop-engineering-planet loop-engineering-planet--${artwork}`} style={style} aria-hidden="true" />;
}
