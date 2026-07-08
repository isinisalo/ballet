import type { ProjectPolicy } from "@shared/api/workspace-contracts";

export type ActionInputSource = {
  type: "event";
  id: string;
  label: string;
};

type PolicyInput = Pick<ProjectPolicy, "event">;

export function actionInputSourceForPolicy(policy: PolicyInput | undefined): ActionInputSource | undefined {
  if (!policy) return undefined;
  if (policy.event) {
    return { type: "event", id: policy.event, label: policy.event };
  }
  return undefined;
}

export function actionInputSources(
  policies: Array<Pick<ProjectPolicy, "action" | "event">>,
  actionId: string
): ActionInputSource[] {
  if (!actionId) return [];
  return policies.flatMap((policy) => {
    if (policy.action !== actionId) return [];
    const source = actionInputSourceForPolicy(policy);
    return source ? [source] : [];
  });
}
