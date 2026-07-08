import type { ProjectPolicy } from "@shared/api/workspace-contracts";
import { generatedPolicyId, normalizePolicyToken } from "@shared/policy-actions";

const slugValue = (value: string, fallback: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;

export const editablePolicyToken = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+/, "");

export const uniqueAutomationId = (base: string, ids: string[]) => {
  let candidate = slugValue(base, "item");
  let suffix = 2;
  while (ids.includes(candidate)) {
    candidate = `${slugValue(base, "item")}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};

export const uniquePolicyAction = (event: string, baseAction: string, policies: ProjectPolicy[], loopId?: string) => {
  const base = normalizePolicyToken(baseAction) || "action";
  let action = base;
  let suffix = 2;
  while (policies.some((policy) => policy.id === generatedPolicyId({ loopId, source: "event", event, action }))) {
    action = `${base}-${suffix}`;
    suffix += 1;
  }
  return action;
};
