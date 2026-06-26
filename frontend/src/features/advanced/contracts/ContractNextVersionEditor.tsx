import { CopyPlus } from "lucide-react";
import { useState } from "react";
import type { AppData } from "backend/shared/domain";
import type { ContractDefinition } from "backend/shared/contracts";
import type { DataShapeFieldDraft } from "backend/shared/flow";
import { api } from "@/api";
import { DataShapeBuilder } from "@/components/data-shape-builder/DataShapeBuilder";
import { Button, TextAreaField, TextField } from "@/components/forms/FormControls";
import {
  agentOutputExampleFromFields,
  agentOutputSchemaFromFields,
  evidenceFieldsFromAgentOutputSchema,
  exampleFromFields,
  fieldsFromObjectSchema,
  objectSchemaFromFields,
  resultFieldsFromAgentOutputSchema
} from "@/features/advanced/model/advanced-resource-model";

export function ContractNextVersionEditor({ contract, data, refresh }: { contract: ContractDefinition; data: AppData; refresh: () => Promise<void> }) {
  const nextVersion = Math.max(...data.contracts.filter((item) => item.id === contract.id).map((item) => item.version), contract.version) + 1;
  const editsAgentOutput = contract.kind === "agent-output";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(contract.name);
  const [description, setDescription] = useState(contract.description);
  const [fields, setFields] = useState<DataShapeFieldDraft[]>(() =>
    editsAgentOutput ? resultFieldsFromAgentOutputSchema(contract.schema) : fieldsFromObjectSchema(contract.schema)
  );
  const [evidenceFields, setEvidenceFields] = useState<DataShapeFieldDraft[]>(() =>
    editsAgentOutput ? evidenceFieldsFromAgentOutputSchema(contract.schema) : []
  );
  const [message, setMessage] = useState("");

  const save = async () => {
    setMessage("");
    const schema = editsAgentOutput
      ? agentOutputSchemaFromFields(fields, evidenceFields)
      : objectSchemaFromFields(fields);
    const examples = editsAgentOutput
      ? [agentOutputExampleFromFields(fields, evidenceFields)]
      : [exampleFromFields(fields)];
    try {
      await api.save("contracts", {
        ...contract,
        id: contract.id,
        version: nextVersion,
        name,
        description,
        schema,
        examples,
        frontmatter: undefined,
        relativePath: undefined,
        slug: undefined
      });
      setMessage(`Version ${nextVersion} created.`);
      setOpen(false);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create next version.");
    }
  };

  if (!open) {
    return (
      <div>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <CopyPlus className="size-4" />
          Create next version
        </Button>
        {message ? <div className="mt-2 text-sm text-muted-foreground">{message}</div> : null}
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-md border bg-background p-3" data-testid="contract-next-version-editor">
      <div className="font-medium">Create version {nextVersion}</div>
      {message ? <div role="alert" className="rounded-md border bg-muted/20 p-3 text-sm">{message}</div> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="Data type name" value={name} onChange={setName} />
        <TextAreaField label="Data type description" rows={2} value={description} onChange={setDescription} />
      </div>
      {editsAgentOutput ? (
        <div className="rounded-md border bg-muted/20 p-3 text-sm">
          <div className="font-medium">Protected output envelope</div>
          <div className="mt-1 text-muted-foreground">Status and summary remain required for every task result.</div>
        </div>
      ) : null}
      <DataShapeBuilder title={editsAgentOutput ? "Result fields" : "Fields"} fields={fields} onChange={setFields} />
      {editsAgentOutput ? <DataShapeBuilder title="Evidence fields" fields={evidenceFields} onChange={setEvidenceFields} /> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="button" onClick={() => void save()}>Save next version</Button>
      </div>
    </div>
  );
}
