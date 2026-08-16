import { useMemo, useState, type FormEvent } from "react";
import {
  validationNodeOutcomeSchema,
  workNodeOutcomeSchema,
  type NodeRun,
  type RespondToNodeRunRequest
} from "@shared/api/workspace-contracts";
import { TextAreaField } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function NodeRunResponsePanel({
  node,
  pending,
  onRespond
}: {
  node: NodeRun;
  pending: boolean;
  onRespond: (request: RespondToNodeRunRequest) => Promise<boolean>;
}) {
  const needsInput = node.outcome?.state === "needs_input" ? node.outcome : undefined;
  const [value, setValue] = useState(() => needsInput ? "" : template(node.role));
  const [error, setError] = useState("");
  const label = needsInput ? "Response" : `${title(node.role)} structured outcome`;
  const help = useMemo(() => needsInput
    ? `${needsInput.question}${needsInput.context ? ` · ${needsInput.context}` : ""}`
    : `Submit a strict ${title(node.role)} outcome. Control flow uses only the validated structure.`,
  [needsInput, node.role]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {
      const request = needsInput
        ? resumeRequest(value)
        : outcomeRequest(node.role, value);
      await onRespond(request);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <form className="grid gap-3 border-t border-divider-strong bg-card p-4" onSubmit={(event) => void submit(event)}>
      <div>
        <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {title(node.role)} Node response · attempt {node.attempt}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      </div>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <TextAreaField
        label={label}
        density="compact"
        value={value}
        rows={needsInput ? 3 : 10}
        disabled={pending}
        onChange={setValue}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !value.trim()}>{pending ? "Submitting…" : "Submit"}</Button>
      </div>
    </form>
  );
}

const resumeRequest = (response: string): RespondToNodeRunRequest => {
  if (!response.trim()) throw new Error("Response must not be empty.");
  return { kind: "resume", response };
};

const outcomeRequest = (role: NodeRun["role"], source: string): RespondToNodeRunRequest => {
  let value: unknown;
  try { value = JSON.parse(source); }
  catch (error) { throw new Error(`Outcome is not valid JSON: ${error instanceof Error ? error.message : String(error)}`); }
  if (role === "work") return { kind: "work", outcome: workNodeOutcomeSchema.parse(value) };
  if (role === "validation") return { kind: "validation", outcome: validationNodeOutcomeSchema.parse(value) };
  throw new Error("Orchestrator responses are not available in this runtime phase.");
};

const title = (role: NodeRun["role"]): string => role === "work" ? "Work" : role === "validation" ? "Validation" : "Orchestrator";
const template = (role: NodeRun["role"]): string => JSON.stringify(role === "validation" ? {
  role: "validation", state: "completed", decision: "OK", summary: "", evidence: {}, checks: []
} : {
  role: "work", state: "completed", summary: "", artifacts: {}, checks: []
}, null, 2);
