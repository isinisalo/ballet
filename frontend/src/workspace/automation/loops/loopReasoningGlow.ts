export type LoopReasoningGlowLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function loopReasoningGlowLevel(reasoningEffort?: string): LoopReasoningGlowLevel {
  const normalized = reasoningEffort?.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (!normalized || normalized === "provider-default") return 0;
  if (["none", "minimal", "light"].includes(normalized)) return 1;
  if (normalized === "low") return 2;
  if (["medium", "balanced"].includes(normalized)) return 3;
  if (["high", "deep"].includes(normalized)) return 4;
  if (["xhigh", "x-high", "very-high"].includes(normalized)) return 5;
  if (["max", "maximum"].includes(normalized)) return 6;
  if (normalized === "ultra") return 7;
  return 3;
}
