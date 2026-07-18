import type { CSSProperties } from "react";
import "./LoopRouteArtwork.css";

export function LoopRouteArtwork({
  size = 24,
  className
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ "--loop-route-artwork-size": `${size}px` } as CSSProperties}
      className={["loop-route-artwork", className].filter(Boolean).join(" ")}
      data-loop-route-artwork
      aria-hidden="true"
      focusable="false"
    >
      <g>
        <circle cx="6" cy="19" r="3" />
        <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
        <circle cx="18" cy="5" r="3" />
      </g>
    </svg>
  );
}
