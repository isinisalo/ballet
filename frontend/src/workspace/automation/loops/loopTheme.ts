import type { CSSProperties } from "react";
import {
  builtInLoopThemes,
  resolveLoopTheme,
  type LoopEdgeLineStyle,
  type LoopTheme,
  type LoopThemeId
} from "@shared/api/workspace-contracts";

export type {
  LoopConnectionPointStyle,
  LoopEdgeLineStyle,
  LoopNodeRenderer,
  LoopTheme
} from "@shared/api/workspace-contracts";

export const loopThemes = Object.fromEntries(
  builtInLoopThemes.map((theme) => [theme.id, theme])
) as Record<"default" | "open-ai", LoopTheme>;

export function loopTheme(themeId: LoopThemeId, themes: readonly LoopTheme[] = builtInLoopThemes): LoopTheme {
  return resolveLoopTheme(themes, themeId);
}

export function loopThemeOptions(themes: readonly LoopTheme[]) {
  return themes.map(({ id, label }) => ({ value: id, label }));
}

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
