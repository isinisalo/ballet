import type { CSSProperties } from "react";
import type { LoopSummaryStyle } from "@shared/api/workspace-contracts";
import "./LoopSummaryArtwork.css";

export function LoopSummaryArtwork({
  summaryStyle,
  size = 24,
  className
}: {
  summaryStyle: LoopSummaryStyle;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ "--loop-summary-artwork-size": `${size}px` } as CSSProperties}
      className={["loop-summary-artwork", className].filter(Boolean).join(" ")}
      data-loop-summary-style={summaryStyle}
      aria-hidden="true"
      focusable="false"
    >
      {summaryShape(summaryStyle)}
      {summaryStyle === "route" ? null : <OrbitCue />}
    </svg>
  );
}

function OrbitCue() {
  return (
    <>
      <path className="loop-summary-artwork__orbit" d="M2.8 14.4c1.5 4.1 7.3 6.4 12.8 5.1 3.1-.7 5.2-2.3 5.8-4.2" />
      <circle className="loop-summary-artwork__orbiter" cx="21.3" cy="15.3" r="1" />
    </>
  );
}

function summaryShape(summaryStyle: LoopSummaryStyle) {
  switch (summaryStyle) {
    case "route":
      return (
        <g className="loop-summary-artwork__route">
          <circle cx="6" cy="19" r="3" />
          <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
          <circle cx="18" cy="5" r="3" />
        </g>
      );
    case "spiral":
      return (
        <g>
          <path className="loop-summary-artwork__galaxy-fill" d="M4.4 12.5c.2-4.3 3.6-7.4 8.1-7.3 4 .1 6.8 2.7 6.6 5.8-.2 2.7-2.8 4.6-6 4.3-2.5-.2-4-1.8-3.6-3.3.3-1.2 1.7-1.9 3-1.5" />
          <circle className="loop-summary-artwork__core" cx="12.6" cy="10.7" r="1.4" />
        </g>
      );
    case "barred-spiral":
      return (
        <g>
          <path className="loop-summary-artwork__galaxy-line" d="M3.9 13.8c1.4-5 5.6-7.6 9.6-6.7 2.8.6 4.9 2.7 5.3 5.1M5.4 16.4c2.1 1.6 5.3 1.9 8 .6 2.3-1.1 3.8-3.2 4.2-5.4" />
          <path className="loop-summary-artwork__bar" d="m7.3 14.7 9.5-5" />
          <circle className="loop-summary-artwork__core" cx="12" cy="12.2" r="1.3" />
        </g>
      );
    case "ring":
      return (
        <g>
          <ellipse className="loop-summary-artwork__ring" cx="12" cy="11.4" rx="7.7" ry="5.4" />
          <ellipse className="loop-summary-artwork__ring loop-summary-artwork__ring--inner" cx="12" cy="11.4" rx="4.5" ry="2.9" />
          <circle className="loop-summary-artwork__core" cx="12" cy="11.4" r="1.5" />
        </g>
      );
    case "edge-on":
      return (
        <g>
          <path className="loop-summary-artwork__disc" d="M2.8 12.6c3.4-2.1 6.5-3 9.5-2.9 3.6.1 6.6 1.2 8.9 3.4-3.5 1.5-6.7 2.1-9.8 1.9-3.2-.2-6.1-.9-8.6-2.4Z" />
          <path className="loop-summary-artwork__galaxy-line" d="M4.5 12.6h15.2" />
          <circle className="loop-summary-artwork__core" cx="12" cy="12.4" r="1.4" />
        </g>
      );
    case "twin-core":
      return (
        <g>
          <path className="loop-summary-artwork__galaxy-line" d="M4.5 14.8c1.1-5.5 5.2-8.4 9.7-7.5 3.2.7 5.2 3.2 4.9 6.1M5.5 10.1c2.2-2.8 6.4-3.6 9.6-1.6 2.1 1.3 3.1 3.5 2.7 5.6" />
          <circle className="loop-summary-artwork__core" cx="10.3" cy="11.8" r="1.7" />
          <circle className="loop-summary-artwork__core loop-summary-artwork__core--secondary" cx="14.2" cy="12.9" r="1.5" />
        </g>
      );
    case "irregular-nebula":
      return (
        <g>
          <path className="loop-summary-artwork__nebula" d="M4.2 13.8c-1.1-2.3.7-4.6 3.1-4.7.5-2.8 4.3-3.7 6-1.4 2.7-1.1 5.6.7 5.3 3.4 2.2 1.4 1.4 4.6-1.2 5.2-1.3 2.2-4.4 2.2-5.7.2-2.3 1.2-5.2-.1-5.4-2.6-1.3.3-2.5-.6-2.1-2.1Z" />
          <circle className="loop-summary-artwork__star" cx="8.1" cy="12.1" r=".8" />
          <circle className="loop-summary-artwork__star" cx="14.6" cy="10.7" r=".65" />
          <circle className="loop-summary-artwork__star" cx="13" cy="15.1" r=".55" />
        </g>
      );
  }
}
