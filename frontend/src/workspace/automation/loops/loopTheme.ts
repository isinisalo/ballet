import type { CSSProperties } from "react";
import {
  type LoopEdgeLineStyle,
  type LoopTheme
} from "@shared/api/workspace-contracts";

export type {
  LoopConnectionPointStyle,
  LoopEdgeLineStyle,
  LoopTheme
} from "@shared/api/workspace-contracts";

export function loopThemeNodeGlow(theme: LoopTheme) {
  return theme.node.glowColor;
}

export function loopThemeCssProperties(theme: LoopTheme): CSSProperties {
  return {
    "--loop-theme-node-label": theme.node.labelColor,
    "--loop-theme-edge-color": theme.edge.color,
    "--loop-theme-edge-label": theme.edge.labelColor,
    "--loop-theme-connection-point": theme.connectionPoint.color
  } as CSSProperties;
}

export function loopEdgeDasharray(style: LoopEdgeLineStyle) {
  if (style === "dashed") return "6 5";
  if (style === "dotted") return "1 5";
  return undefined;
}
