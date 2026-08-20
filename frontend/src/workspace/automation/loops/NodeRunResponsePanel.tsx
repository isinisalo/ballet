import { useState, type FormEvent } from "react";
import type { NodeRun, RespondToNodeRunRequest } from "@shared/api/workspace-contracts";
import { TextAreaField } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { HumanValidationResponseForm } from "./HumanValidationResponseForm";
import { HumanJobResponseForm } from "./HumanJobResponseForm";
import { buildResumeResponse } from "./humanNodeResponse";

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
  return (
    <section className="grid gap-3 border-t border-divider-strong bg-card p-4" aria-labelledby={`node-response-${node.nodeRunId}`}>
      <div>
        <h2 id={`node-response-${node.nodeRunId}`} className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {title(node.role)} Node response · attempt {node.attempt}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Only the role-specific validated payload can advance control flow.</p>
      </div>
      {needsInput ? <ResumeForm question={needsInput.question} context={needsInput.context} pending={pending} onRespond={onRespond} />
        : node.role === "job" ? <HumanJobResponseForm pending={pending} onRespond={onRespond} />
          : node.role === "validation" ? <HumanValidationResponseForm pending={pending} onRespond={onRespond} />
            : <Alert><AlertDescription>Orchestrator routing is provider-controlled. A human response is accepted only when this Node requests input.</AlertDescription></Alert>}
    </section>
  );
}

function ResumeForm({ question, context, pending, onRespond }: {
  question: string; context: string; pending: boolean;
  onRespond: (request: RespondToNodeRunRequest) => Promise<boolean>;
}) {
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    try { await onRespond(buildResumeResponse(response)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  return <form className="grid gap-3" aria-label="Resume Node response" onSubmit={(event) => void submit(event)}>
    {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    <TextAreaField label="Response" description={`${question}${context ? ` · ${context}` : ""}`} density="compact" required value={response} disabled={pending} onChange={setResponse} />
    <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Submitting…" : "Resume"}</Button></div>
  </form>;
}

const title = (role: NodeRun["role"]): string => role === "job" ? "Job" : role === "validation" ? "Validation" : "Orchestrator";
