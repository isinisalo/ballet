import {
  loopNodeSizeCatalog,
  loopNodeSizes,
  loopNodeStyleCatalog,
  loopNodeStyles,
  type LoopNodeSize,
  type LoopNodeStyle,
  type ProjectNodeAppearance
} from "@shared/api/workspace-contracts";
import { SelectField } from "@/components/shared/workspace-ui";

export function NodeAppearanceFields({ value, roleLabel, disabled, onChange }: {
  value: ProjectNodeAppearance;
  roleLabel: string;
  disabled: boolean;
  onChange: (value: ProjectNodeAppearance) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SelectField
        label={`${roleLabel} artwork`}
        value={value.nodeStyle}
        options={loopNodeStyles.map((style) => ({ value: style, label: loopNodeStyleCatalog[style].label }))}
        disabled={disabled}
        density="compact"
        onChange={(nodeStyle) => onChange({ ...value, nodeStyle: nodeStyle as LoopNodeStyle })}
      />
      <SelectField
        label={`${roleLabel} artwork size`}
        value={value.nodeSize}
        options={loopNodeSizes.map((size) => ({ value: size, label: loopNodeSizeCatalog[size].label }))}
        disabled={disabled}
        density="compact"
        onChange={(nodeSize) => onChange({ ...value, nodeSize: nodeSize as LoopNodeSize })}
      />
    </div>
  );
}
