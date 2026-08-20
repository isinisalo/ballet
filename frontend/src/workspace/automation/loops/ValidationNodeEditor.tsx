import {
  isProjectAgentValidationNode,
  type ExecutionProfile,
  type LocalRuntime,
  type ProjectInstruction,
  type ProjectValidationNode,
  type Skill
} from "@shared/api/workspace-contracts";
import { Bot, ShieldCheck, UserRound } from "lucide-react";
import type { ProjectLoop } from "@shared/api/workspace-contracts";
import { SelectField, TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { ExecutionCompositionFields } from "./ExecutionCompositionFields";
import { NodeAppearanceFields } from "./NodeAppearanceFields";
import { changeValidationNodeType } from "./loopEditorState";
import { validationNodeIdError } from "./loopFormValidation";

export function ValidationNodeEditor({ node, loop, allLoops, profiles, instructions, skills, runtime, disabled, onChange }: {
  node: ProjectValidationNode;
  loop: ProjectLoop;
  allLoops: ProjectLoop[];
  profiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  runtime: LocalRuntime;
  disabled: boolean;
  onChange: (node: ProjectValidationNode) => void;
}) {
  const taskError = node.task.trim() ? undefined : "Validation criteria are required.";
  return (
    <form aria-label={`Validation Node ${node.id}`} className="grid gap-4 p-4" onSubmit={(event) => event.preventDefault()}>
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-secondary" aria-hidden="true" />
        <h3 id="validation-node-heading" className="font-mono text-xs font-semibold uppercase tracking-[0.08em]">Validation Node</h3>
        <span className="ml-auto flex items-center gap-1 font-mono text-[0.62rem] text-muted-foreground">
          {node.type === "agent" ? <Bot className="size-3" /> : <UserRound className="size-3" />}
          {node.type}
        </span>
      </div>
      <TextField label="Validation Node ID" value={node.id} error={validationNodeIdError(node, loop, allLoops)} required disabled={disabled} density="compact" maxLength={160} onChange={(id) => onChange({ ...node, id })} />
      <TextAreaField label="Validation description" value={node.description} error={node.description.trim() ? undefined : "Validation description is required."} required disabled={disabled} density="compact" rows={2} maxLength={2_000} onChange={(description) => onChange({ ...node, description })} />
      <SelectField
        label="Validation node type"
        value={node.type}
        options={[{ value: "agent", label: "Agent" }, { value: "human", label: "Human" }]}
        disabled={disabled}
        density="compact"
        onChange={(type) => onChange(changeValidationNodeType(node, type as ProjectValidationNode["type"]))}
      />
      <TextAreaField label="Validation criteria" value={node.task} error={taskError} required disabled={disabled} density="compact" rows={4} maxLength={20_000} onChange={(task) => onChange({ ...node, task })} />
      {isProjectAgentValidationNode(node) ? (
        <ExecutionCompositionFields
          roleLabel="Validation"
          value={node}
          profiles={profiles}
          instructions={instructions}
          skills={skills}
          runtime={runtime}
          disabled={disabled}
          onChange={(composition) => onChange({ ...node, ...composition })}
        />
      ) : null}
      <NodeAppearanceFields value={node} roleLabel="Validation" disabled={disabled} onChange={(appearance) => onChange({ ...node, ...appearance })} />
      <p className="rounded-lg border border-divider-strong bg-panel-section p-3 text-xs text-muted-foreground">A completed Validation returns <strong className="text-secondary">PASS</strong> or <strong className="text-destructive">FAIL</strong>. FAIL always includes correction feedback and capability/outcome escalation.</p>
    </form>
  );
}
