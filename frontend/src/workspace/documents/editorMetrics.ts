export const countEditorWords = (value: string): number =>
  value.trim().split(/\s+/).filter(Boolean).length;

export const estimateEditorTokens = (value: string): number =>
  Math.max(0, Math.ceil(value.length / 4));

export const formatEditorMetric = (value: number): string => {
  if (value < 1000) return String(value);
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
};
