import type { CSSProperties } from "react";
import type { LoopNodeSize, LoopThemeId } from "@shared/api/workspace-contracts";

export type LoopEdgeLineStyle = "solid" | "dashed" | "dotted";
export type LoopConnectionPointStyle = "near" | "flow";
export type LoopNodeRenderer = "flat" | "luna" | "terra" | "sol";

export type LoopTheme = {
  id: LoopThemeId;
  label: string;
  node: {
    labelColor: string;
    glowColor: string;
    sizes: Record<LoopNodeSize, {
      renderer: LoopNodeRenderer;
      glowColor?: string;
    }>;
    showAgentAvatarInNode: boolean;
  };
  edge: {
    color: string;
    labelColor: string;
    style: LoopEdgeLineStyle;
    rejectedStyle: LoopEdgeLineStyle;
    crossLoopStyle: LoopEdgeLineStyle;
  };
  connectionPoint: {
    style: LoopConnectionPointStyle;
    color: string;
  };
};

const openAiReasoningGlow = {
  small: "color-mix(in srgb, var(--foreground) 78%, var(--muted-foreground))",
  medium: "color-mix(in srgb, var(--muted-foreground) 42%, var(--secondary))",
  large: "color-mix(in srgb, var(--muted-foreground) 36%, var(--tertiary))"
} satisfies Record<LoopNodeSize, string>;

export const loopThemes = {
  default: {
    id: "default",
    label: "Default",
    node: {
      labelColor: "#c1c6d7",
      glowColor: "#adc6ff",
      sizes: {
        small: { renderer: "flat" },
        medium: { renderer: "flat" },
        large: { renderer: "flat" }
      },
      showAgentAvatarInNode: true
    },
    edge: {
      color: "#8b90a0",
      labelColor: "#c1c6d7",
      style: "solid",
      rejectedStyle: "dashed",
      crossLoopStyle: "dotted"
    },
    connectionPoint: {
      style: "flow",
      color: "#adc6ff"
    }
  },
  "open-ai": {
    id: "open-ai",
    label: "OpenAI",
    node: {
      labelColor: "#ffb95f",
      glowColor: openAiReasoningGlow.medium,
      sizes: {
        small: { renderer: "luna", glowColor: openAiReasoningGlow.small },
        medium: { renderer: "terra", glowColor: openAiReasoningGlow.medium },
        large: { renderer: "sol", glowColor: openAiReasoningGlow.large }
      },
      showAgentAvatarInNode: false
    },
    edge: {
      color: "#76d4ca",
      labelColor: "#c1c6d7",
      style: "solid",
      rejectedStyle: "dashed",
      crossLoopStyle: "dotted"
    },
    connectionPoint: {
      style: "near",
      color: "#e3fffb"
    }
  }
} satisfies Record<LoopThemeId, LoopTheme>;

export const loopThemeOptions = Object.values(loopThemes).map(({ id, label }) => ({ value: id, label }));

export function loopTheme(themeId: LoopThemeId): LoopTheme {
  return loopThemes[themeId];
}

export function loopThemeNodeGlow(theme: LoopTheme, size: LoopNodeSize) {
  return theme.node.sizes[size].glowColor ?? theme.node.glowColor;
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
