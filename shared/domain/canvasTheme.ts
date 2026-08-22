export const canvasConnectionLineStyles = ["solid", "dashed", "dotted"] as const;
export type CanvasConnectionLineStyle = (typeof canvasConnectionLineStyles)[number];

export const canvasConnectionPointStyles = ["near", "flow"] as const;
export type CanvasConnectionPointStyle = (typeof canvasConnectionPointStyles)[number];

export interface CanvasTheme {
  version: 4;
  node: {
    labelColor: string;
    glowColor: string;
  };
  edge: {
    color: string;
    labelColor: string;
    style: CanvasConnectionLineStyle;
    repairStyle: CanvasConnectionLineStyle;
    crossScopeStyle: CanvasConnectionLineStyle;
  };
  connectionPoint: {
    style: CanvasConnectionPointStyle;
    color: string;
  };
}

export interface CanvasThemeIssue {
  path: string;
  message: string;
}

export const defaultCanvasTheme: CanvasTheme = {
  version: 4,
  node: {
    labelColor: "#ffb95f",
    glowColor: "#8b90a0"
  },
  edge: {
    color: "#76d4ca",
    labelColor: "#c1c6d7",
    style: "solid",
    repairStyle: "dotted",
    crossScopeStyle: "dashed"
  },
  connectionPoint: { style: "near", color: "#e3fffb" }
};
