import type { ProjectPolicy } from "@shared/api/workspace-contracts";

export type ActionInputSource = {
  type: ProjectPolicy["source"];
  id: string;
  label: string;
};

type PolicyInput = Pick<ProjectPolicy, "source" | "event" | "trigger">;

export function actionInputSourceForPolicy(policy: PolicyInput | undefined): ActionInputSource | undefined {
  if (!policy) return undefined;
  if (policy.source === "trigger" && policy.trigger) {
    return { type: "trigger", id: policy.trigger, label: policy.trigger };
  }
  if (policy.source === "event" && policy.event) {
    return { type: "event", id: policy.event, label: policy.event };
  }
  return undefined;
}

export function actionInputSources(
  policies: Array<Pick<ProjectPolicy, "action" | "source" | "event" | "trigger">>,
  actionId: string
): ActionInputSource[] {
  if (!actionId) return [];
  return policies.flatMap((policy) => {
    if (policy.action !== actionId) return [];
    const source = actionInputSourceForPolicy(policy);
    return source ? [source] : [];
  });
}
