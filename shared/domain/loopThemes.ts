export const loopEdgeLineStyles = ["solid", "dashed", "dotted"] as const;
export type LoopEdgeLineStyle = (typeof loopEdgeLineStyles)[number];

export const loopConnectionPointStyles = ["near", "flow"] as const;
export type LoopConnectionPointStyle = (typeof loopConnectionPointStyles)[number];

export interface LoopTheme {
  version: 2;
  node: {
    labelColor: string;
    glowColor: string;
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
}

export interface LoopThemeIssue {
  path: string;
  message: string;
}

export const defaultLoopTheme: LoopTheme = {
  version: 2,
  node: {
    labelColor: "#ffb95f",
    glowColor: "#8b90a0",
    showAgentAvatarInNode: false
  },
  edge: {
    color: "#76d4ca",
    labelColor: "#c1c6d7",
    style: "solid",
    rejectedStyle: "dotted",
    crossLoopStyle: "dashed"
  },
  connectionPoint: { style: "near", color: "#e3fffb" }
};
