import {
  isProjectAgentValidationNode,
  type ExecutionProfile,
  type LocalRuntime,
  type ProjectInstruction,
  type ProjectValidationNode,
  type Skill
} from "@shared/api/workspace-contracts";
import { Bot, ShieldCheck, UserRound } from "lucide-react";
import { SelectField, TextAreaField } from "@/components/shared/workspace-ui";
import { ExecutionCompositionFields } from "./ExecutionCompositionFields";
import { NodeAppearanceFields } from "./NodeAppearanceFields";
import { changeValidationNodeType } from "./loopEditorState";

export function ValidationNodeEditor({ node, profiles, instructions, skills, runtime, disabled, onChange }: {
  node: ProjectValidationNode;
  profiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  runtime: LocalRuntime;
  disabled: boolean;
  onChange: (node: ProjectValidationNode) => void;
}) {
  const taskError = node.task.trim() ? undefined : "Validation criteria are required.";
  return (
    <section aria-labelledby="validation-node-heading" className="grid gap-3 rounded-lg border border-divider-strong bg-card p-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-secondary" aria-hidden="true" />
        <h3 id="validation-node-heading" className="font-mono text-xs font-semibold uppercase tracking-[0.08em]">Validation Node</h3>
        <span className="ml-auto flex items-center gap-1 font-mono text-[0.62rem] text-muted-foreground">
          {node.type === "agent" ? <Bot className="size-3" /> : <UserRound className="size-3" />}
          {node.type}
        </span>
      </div>
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
    </section>
  );
}
