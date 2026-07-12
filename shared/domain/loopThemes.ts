import type { LoopNodeSize, ProjectAutomationConfig } from "./automation.js";

export type LoopThemeId = string;

export const loopNodeRenderers = ["flat", "luna", "terra", "sol"] as const;
export type LoopNodeRenderer = (typeof loopNodeRenderers)[number];

export const loopEdgeLineStyles = ["solid", "dashed", "dotted"] as const;
export type LoopEdgeLineStyle = (typeof loopEdgeLineStyles)[number];

export const loopConnectionPointStyles = ["near", "flow"] as const;
export type LoopConnectionPointStyle = (typeof loopConnectionPointStyles)[number];

export interface LoopTheme {
  version: 1;
  id: LoopThemeId;
  label: string;
  node: {
    labelColor: string;
    glowColor: string;
    styles: Record<LoopNodeSize, LoopNodeRenderer>;
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
  themeId?: LoopThemeId;
  loopId?: string;
}

export const builtInLoopThemes: readonly LoopTheme[] = [{
  version: 1,
  id: "default",
  label: "Default",
  node: {
    labelColor: "#c1c6d7",
    glowColor: "#adc6ff",
    styles: { small: "flat", medium: "flat", large: "flat" },
    showAgentAvatarInNode: true
  },
  edge: {
    color: "#8b90a0",
    labelColor: "#c1c6d7",
    style: "solid",
    rejectedStyle: "dashed",
    crossLoopStyle: "dotted"
  },
  connectionPoint: { style: "flow", color: "#adc6ff" }
}, {
  version: 1,
  id: "open-ai",
  label: "OpenAI",
  node: {
    labelColor: "#ffb95f",
    glowColor: "#8b90a0",
    styles: { small: "luna", medium: "terra", large: "sol" },
    showAgentAvatarInNode: false
  },
  edge: {
    color: "#76d4ca",
    labelColor: "#c1c6d7",
    style: "solid",
    rejectedStyle: "dashed",
    crossLoopStyle: "dotted"
  },
  connectionPoint: { style: "near", color: "#e3fffb" }
}];

export const defaultLoopTheme: LoopTheme = builtInLoopThemes[0]!;

export const resolveLoopTheme = (
  themes: readonly LoopTheme[],
  themeId: LoopThemeId
): LoopTheme => themes.find((theme) => theme.id === themeId)
  ?? themes.find((theme) => theme.id === defaultLoopTheme.id)
  ?? defaultLoopTheme;

export const validateAutomationThemeReferences = (
  config: ProjectAutomationConfig,
  themes: readonly LoopTheme[]
): LoopThemeIssue[] => {
  const themeIds = new Set(themes.map((theme) => theme.id));
  return config.loops.flatMap((loop, index) => themeIds.has(loop.theme) ? [] : [{
    path: `loops.${index}.theme`,
    message: `Loop ${loop.id} references unknown theme: ${loop.theme}.`,
    themeId: loop.theme,
    loopId: loop.id
  }]);
};

export const introducedLoopThemeReferenceIssues = (
  current: readonly LoopThemeIssue[],
  candidate: readonly LoopThemeIssue[]
): LoopThemeIssue[] => {
  const currentKeys = new Set(current.map(loopThemeReferenceIssueKey));
  return candidate.filter((issue) => !currentKeys.has(loopThemeReferenceIssueKey(issue)));
};

const loopThemeReferenceIssueKey = (issue: LoopThemeIssue): string =>
  `${issue.path}\0${issue.themeId ?? ""}\0${issue.loopId ?? ""}`;
