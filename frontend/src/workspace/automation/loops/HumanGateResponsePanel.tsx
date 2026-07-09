import { useEffect, useId, useState } from "react";
import type { ProjectHumanGateResponse } from "@shared/api/workspace-contracts";
import { SendHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export function HumanGateResponsePanel({
  slotIds,
  response,
  onSubmit
}: {
  slotIds: string[];
  response?: ProjectHumanGateResponse;
  onSubmit: (outputId: string, prompt: string) => void;
}) {
  const promptId = useId();
  const [prompt, setPrompt] = useState(response?.prompt ?? "");
  const [error, setError] = useState("");
  const approvalOutputId = slotIds[0];
  const reworkOutputId = slotIds[1];

  useEffect(() => {
    setPrompt(response?.prompt ?? "");
    setError("");
  }, [response?.id, response?.prompt]);

  const submit = (outputId: string | undefined) => {
    if (!outputId) return;
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError("Prompt to agent is required before continuing.");
      return;
    }
    setError("");
    onSubmit(outputId, trimmedPrompt);
  };

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Human gate response</FieldLabel>
        <div className="flex min-h-7 flex-wrap items-center gap-2">
          {response ? (
            <Badge variant="outline" className="border-secondary/60 bg-secondary/10 font-mono text-secondary">
              Sent · {response.outputId}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-tertiary/60 bg-tertiary/10 font-mono text-tertiary">
              Waiting for human
            </Badge>
          )}
        </div>
      </Field>
      <Field className="gap-1.5" data-invalid={Boolean(error)}>
        <FieldLabel htmlFor={promptId}>Prompt to agent</FieldLabel>
        <Textarea
          id={promptId}
          value={prompt}
          rows={5}
          aria-invalid={Boolean(error)}
          placeholder="Write clear next-step instructions for the agent."
          onChange={(event) => setPrompt(event.target.value)}
        />
        <FieldDescription>Sent forward as the human answer.</FieldDescription>
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {reworkOutputId ? (
          <Button type="button" variant="outline" onClick={() => submit(reworkOutputId)}>
            <SendHorizontal data-icon="inline-start" />
            Rejected · {reworkOutputId}
          </Button>
        ) : null}
        {approvalOutputId ? (
          <Button type="button" onClick={() => submit(approvalOutputId)}>
            <SendHorizontal data-icon="inline-start" />
            Approved · {approvalOutputId}
          </Button>
        ) : null}
      </div>
    </FieldGroup>
  );
}
