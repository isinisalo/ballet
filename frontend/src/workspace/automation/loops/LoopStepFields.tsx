import { useId, type ReactNode } from "react";
import type { LoopNodeSize, LoopNodeStyle, ProjectLoopNode } from "@shared/api/workspace-contracts";
import { loopNodeSizeCatalog, loopNodeSizes, loopNodeStyleCatalog, loopNodeStyles } from "@shared/api/workspace-contracts";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { LoopEditorSelect } from "./LoopEditorSelect";

const nodeStyleGroupLabels = {
  classic: "Classic",
  planet: "Planets"
} as const;

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
        label: loopNodeStyleCatalog[style].label,
        group: nodeStyleGroupLabels[loopNodeStyleCatalog[style].group]
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

export function CompactSelectField({ label, ariaLabel, value, options, disabled, invalid, error, onChange }: {
  label: ReactNode;
  ariaLabel: string;
  value: string;
  options: Array<{ value: string; label: string; group?: string }>;
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
