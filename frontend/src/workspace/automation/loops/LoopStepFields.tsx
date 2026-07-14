import { useId, type ReactNode } from "react";
import type { Agent, LoopNodeSize, LoopNodeStyle, ProjectLoopNode, ProjectStep } from "@shared/api/workspace-contracts";
import { loopNodeSizeCatalog, loopNodeSizes, loopNodeStyleCatalog, loopNodeStyles } from "@shared/api/workspace-contracts";
import { ShieldCheck } from "lucide-react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { LoopEditorSelect } from "./LoopEditorSelect";

export function NodeStyleField({ node, disabled, onChange }: {
  node: ProjectLoopNode;
  disabled: boolean;
  onChange: (node: ProjectLoopNode) => void;
}) {
  return (
    <CompactSelectField
      label="Node style"
      ariaLabel="Node style"
      value={node.nodeStyle}
      disabled={disabled}
      options={loopNodeStyles.map((style) => ({
        value: style,
        label: loopNodeStyleCatalog[style].label
      }))}
      onChange={(nodeStyle) => onChange({ ...node, nodeStyle: nodeStyle as LoopNodeStyle } as ProjectLoopNode)}
    />
  );
}

export function NodeSizeField({ node, disabled, onChange }: {
  node: ProjectLoopNode;
  disabled: boolean;
  onChange: (node: ProjectLoopNode) => void;
}) {
  return (
    <CompactSelectField
      label="Node size"
      ariaLabel="Node size"
      value={node.nodeSize}
      disabled={disabled}
      options={loopNodeSizes.map((size) => ({ value: size, label: loopNodeSizeCatalog[size].label }))}
      onChange={(nodeSize) => onChange({ ...node, nodeSize: nodeSize as LoopNodeSize } as ProjectLoopNode)}
    />
  );
}

export function StepOwner({ step, agents, disabled, onChange }: {
  step: ProjectStep;
  agents: Agent[];
  disabled: boolean;
  onChange: (step: ProjectStep) => void;
}) {
  if (step.type === "agent" || step.type === "scheduled") {
    return (
      <CompactSelectField
        label="Agent"
        ariaLabel="Agent"
        value={step.agentId}
        disabled={disabled || agents.length === 0}
        invalid={!step.agentId}
        error={!step.agentId ? "Select an agent." : undefined}
        options={agents.map((agent) => ({ value: agent.id, label: agent.name ? `${agent.id} · ${agent.name}` : agent.id }))}
        onChange={(agentId) => onChange({ ...step, agentId } as ProjectStep)}
      />
    );
  }
  return (
    <Field className="grid grid-cols-1 items-start gap-1.5 @sm/loop-form:grid-cols-[5.5rem_minmax(0,1fr)] @sm/loop-form:items-center @sm/loop-form:gap-2">
      <span className="text-xs font-normal text-muted-foreground">Agent</span>
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-tertiary"><ShieldCheck className="size-3.5 shrink-0" /><span>Human operator</span></div>
    </Field>
  );
}

export function CompactSelectField({ label, ariaLabel, value, options, disabled, invalid, error, onChange }: {
  label: ReactNode;
  ariaLabel: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled: boolean;
  invalid?: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <Field className="grid grid-cols-1 items-start gap-1.5 @sm/loop-form:grid-cols-[5.5rem_minmax(0,1fr)] @sm/loop-form:gap-2" data-invalid={Boolean(invalid || error)}>
      <FieldLabel htmlFor={id} className="text-xs font-normal text-muted-foreground @sm/loop-form:pt-1">{label}</FieldLabel>
      <div className="grid min-w-0 gap-1">
        <LoopEditorSelect id={id} ariaLabel={ariaLabel} density="form" value={value} disabled={disabled} invalid={Boolean(invalid || error)} describedBy={error ? errorId : undefined} options={options} onChange={onChange} />
        {error ? <FieldError id={errorId} className="text-[0.65rem] leading-4">{error}</FieldError> : null}
      </div>
    </Field>
  );
}
