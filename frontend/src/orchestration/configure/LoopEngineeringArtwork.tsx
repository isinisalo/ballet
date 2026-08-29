import type { CSSProperties } from "react";
import type { ActionArtwork } from "./loopEngineeringProjection";

export function StateRouteArtwork() {
  return <svg viewBox="0 0 24 24" className="loop-engineering-state-artwork" aria-hidden="true" focusable="false">
    <g><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" /></g>
  </svg>;
}

export function ActionPlanetArtwork({ artwork, size }: { artwork: ActionArtwork; size: number }) {
  const style = { "--action-planet-size": `${size}px` } as CSSProperties;
  if (artwork === "station") return <span className="loop-engineering-planet loop-engineering-planet--station" style={style} aria-hidden="true">
    <svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="9.5" /><path d="M2.8 11.1h18.4M3 13h18M7.1 4.1l1.5 5m8.2-4.5-1.4 4.5M7.2 15l-1.1 4m10.7-4 1 3.8" /><path d="m12 7.1 3.2 1.8v3.7L12 14.4l-3.2-1.8V8.9Z" /><circle cx="12" cy="10.8" r="1.2" /></svg>
  </span>;
  return <span className={`loop-engineering-planet loop-engineering-planet--${artwork}`} style={style} aria-hidden="true" />;
}
