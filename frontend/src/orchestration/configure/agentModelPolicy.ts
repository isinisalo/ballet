import type { RuntimeModelCapability } from "@shared/domain/runtime";

export const AUTHORING_MODEL_IDS = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"] as const;
export type AuthoringModelId = typeof AUTHORING_MODEL_IDS[number];

export function authoringModels(models: RuntimeModelCapability[]): RuntimeModelCapability[] {
  const byId = new Map(models.map((model) => [model.id, model]));
  return AUTHORING_MODEL_IDS.flatMap((id) => {
    const model = byId.get(id);
    return model ? [model] : [];
  });
}

export function isAuthoringModelId(model: string): model is AuthoringModelId {
  return AUTHORING_MODEL_IDS.some((id) => id === model);
}

export function unsupportedAuthoringModelMessage(model: string): string {
  return `Model ${model || "is missing"} is not available for authoring. Choose ${AUTHORING_MODEL_IDS[0]}, ${AUTHORING_MODEL_IDS[1]}, or ${AUTHORING_MODEL_IDS[2]}.`;
}
