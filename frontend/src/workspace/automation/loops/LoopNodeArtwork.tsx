import type { LoopNodeStyle } from "@shared/api/workspace-contracts";

export function LoopNodeArtwork({ nodeStyle }: { nodeStyle: LoopNodeStyle }) {
  return (
    <span
      aria-hidden="true"
      data-loop-node-artwork={nodeStyle}
      className={`loop-node-surface loop-node-surface--${nodeStyle}`}
    >
      {nodeStyle === "black-hole" ? <BlackHoleArtwork /> : null}
      {nodeStyle === "satellite" ? <SatelliteArtwork /> : null}
      {nodeStyle === "meteorite" ? <MeteoriteArtwork /> : null}
      {nodeStyle === "spaceman" ? <SpacemanArtwork /> : null}
    </span>
  );
}

function BlackHoleArtwork() {
  return (
    <svg viewBox="0 0 24 24" className="loop-node-artwork-svg" focusable="false">
      <ellipse className="loop-node-black-hole-orbit loop-node-black-hole-orbit--outer" cx="12" cy="12" rx="10" ry="3.8" />
      <ellipse className="loop-node-black-hole-orbit loop-node-black-hole-orbit--inner" cx="12" cy="12" rx="7.5" ry="2.4" />
      <circle className="loop-node-black-hole-core" cx="12" cy="12" r="4.8" />
    </svg>
  );
}

function SatelliteArtwork() {
  return (
    <svg viewBox="0 0 24 24" className="loop-node-artwork-svg" focusable="false">
      <path className="loop-node-satellite-panel" d="M1.8 8.2h6v7.6h-6zM16.2 8.2h6v7.6h-6z" />
      <path className="loop-node-satellite-grid" d="M4.8 8.7v6.6M1.9 12h5.8M19.2 8.7v6.6M16.3 12h5.8" />
      <path className="loop-node-satellite-arm" d="M7.8 12h2.1M14.1 12h2.1" />
      <rect className="loop-node-satellite-body" x="9.4" y="8" width="5.2" height="8" rx="1" />
      <path className="loop-node-satellite-dish" d="M9.6 7.3c1.3-1.7 3.5-2.1 5.1-.9-1.3 1.7-3.5 2.1-5.1.9Z" />
    </svg>
  );
}

function MeteoriteArtwork() {
  return (
    <svg viewBox="0 0 24 24" className="loop-node-artwork-svg" focusable="false">
      <path className="loop-node-meteorite-body" d="m4.2 8.4 4.6-5.2 6.7 1.1 4.4 5.3-1.5 7.7-6.2 3.6-6.5-3.1-2.2-5.5Z" />
      <circle className="loop-node-meteorite-crater" cx="9" cy="9" r="2" />
      <circle className="loop-node-meteorite-crater" cx="15.4" cy="13.7" r="2.4" />
      <circle className="loop-node-meteorite-crater loop-node-meteorite-crater--small" cx="10.2" cy="16.7" r="1.1" />
    </svg>
  );
}

function SpacemanArtwork() {
  return (
    <svg viewBox="0 0 24 24" className="loop-node-artwork-svg" focusable="false">
      <circle className="loop-node-spaceman-helmet" cx="12" cy="7.4" r="4.2" />
      <path className="loop-node-spaceman-visor" d="M8.9 7.6c.3-2 1.4-3 3.2-3 1.7 0 2.8 1 3.1 3-.8.8-1.8 1.2-3.1 1.2-1.4 0-2.4-.4-3.2-1.2Z" />
      <path className="loop-node-spaceman-suit" d="M8.4 11.1h7.2l1.4 7.2-2.7 1.4-.8-4.5h-3l-.8 4.5L7 18.3Z" />
      <path className="loop-node-spaceman-seams" d="M9.6 13.1h4.8M12 13.2v2M8.1 12.7l-2 3M15.9 12.7l2 3" />
    </svg>
  );
}
