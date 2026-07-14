import type { LoopTheme } from "@shared/api/workspace-contracts";

export const themeColorPattern = /^#[0-9a-fA-F]{6}$/;

export type LoopThemeFieldKey =
  | "node.labelColor"
  | "node.glowColor"
  | "edge.color"
  | "edge.labelColor"
  | "connectionPoint.color";

export type LoopThemeFieldErrors = Partial<Record<LoopThemeFieldKey, string>>;
export type LoopThemeColorKey = LoopThemeFieldKey;

const colorFields: Array<{ key: LoopThemeFieldKey; value: (theme: LoopTheme) => string }> = [
  { key: "node.labelColor", value: (theme) => theme.node.labelColor },
  { key: "node.glowColor", value: (theme) => theme.node.glowColor },
  { key: "edge.color", value: (theme) => theme.edge.color },
  { key: "edge.labelColor", value: (theme) => theme.edge.labelColor },
  { key: "connectionPoint.color", value: (theme) => theme.connectionPoint.color }
];

export function validateLoopThemeDraft(theme: LoopTheme): LoopThemeFieldErrors {
  const errors: LoopThemeFieldErrors = {};
  colorFields.forEach(({ key, value }) => {
    if (!themeColorPattern.test(value(theme))) errors[key] = "Use a six-digit hex color, for example #adc6ff.";
  });
  return errors;
}

export function normalizedLoopTheme(theme: LoopTheme): LoopTheme {
  const normalizedColor = (value: string) => value.toLowerCase();
  return {
    ...theme,
    node: {
      ...theme.node,
      labelColor: normalizedColor(theme.node.labelColor),
      glowColor: normalizedColor(theme.node.glowColor)
    },
    edge: {
      ...theme.edge,
      color: normalizedColor(theme.edge.color),
      labelColor: normalizedColor(theme.edge.labelColor)
    },
    connectionPoint: {
      ...theme.connectionPoint,
      color: normalizedColor(theme.connectionPoint.color)
    }
  };
}

export function withLoopThemeColor(theme: LoopTheme, key: LoopThemeColorKey, value: string): LoopTheme {
  if (key === "node.labelColor") return { ...theme, node: { ...theme.node, labelColor: value } };
  if (key === "node.glowColor") return { ...theme, node: { ...theme.node, glowColor: value } };
  if (key === "edge.color") return { ...theme, edge: { ...theme.edge, color: value } };
  if (key === "edge.labelColor") return { ...theme, edge: { ...theme.edge, labelColor: value } };
  return { ...theme, connectionPoint: { ...theme.connectionPoint, color: value } };
}

export const themeFingerprint = (theme: LoopTheme) => JSON.stringify(theme);
