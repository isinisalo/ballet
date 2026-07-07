const tokenUnderlineClassName = "underline underline-offset-4 decoration-2";
const successOutputs = new Set(["ready", "approved", "complete", "done"]);
const failureOutputs = new Set(["changes_requested", "failed", "blocked", "rejected"]);

export function workflowActionTokenClassName() {
  return `text-tertiary decoration-tertiary ${tokenUnderlineClassName}`;
}

export function workflowOutputTokenClassName(outputId: string) {
  if (successOutputs.has(outputId)) return `text-secondary decoration-secondary ${tokenUnderlineClassName}`;
  if (failureOutputs.has(outputId)) return `text-destructive decoration-destructive ${tokenUnderlineClassName}`;
  return `text-primary decoration-primary ${tokenUnderlineClassName}`;
}
