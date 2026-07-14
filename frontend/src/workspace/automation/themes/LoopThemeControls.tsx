import type {
  LoopConnectionPointStyle,
  LoopEdgeLineStyle,
  LoopTheme
} from "@shared/api/workspace-contracts";
import type { ReactNode } from "react";
import { SelectField } from "@/components/shared/workspace-ui";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { ThemeColorField } from "./ThemeColorField";
import type { LoopThemeColorKey, LoopThemeFieldErrors } from "./loopThemeEditorState";

type ControlsProps = {
  theme: LoopTheme;
  previewTheme: LoopTheme;
  errors: LoopThemeFieldErrors;
  disabled?: boolean;
  onChange: (theme: LoopTheme) => void;
  onColorChange: (key: LoopThemeColorKey, value: string) => void;
};

const lineStyleOptions = ["solid", "dashed", "dotted"].map((value) => ({ value, label: value }));
const connectionStyleOptions = [
  { value: "near", label: "Near · detached" },
  { value: "flow", label: "Flow · attached" }
];

export function LoopThemeNodeControls(props: ControlsProps) {
  const { theme, previewTheme, errors, disabled = false, onChange, onColorChange } = props;

  return (
    <ThemeControlSection title="Node">
      <div className="grid gap-3 sm:grid-cols-2">
        <ThemeColorField label="Label font color" value={theme.node.labelColor} previewValue={previewTheme.node.labelColor} error={errors["node.labelColor"]} disabled={disabled} onChange={(value) => onColorChange("node.labelColor", value)} />
        <ThemeColorField label="Glow color" value={theme.node.glowColor} previewValue={previewTheme.node.glowColor} error={errors["node.glowColor"]} disabled={disabled} onChange={(value) => onColorChange("node.glowColor", value)} />
      </div>
      <Field orientation="horizontal" className="min-h-7 justify-between rounded border border-divider-strong bg-panel-section px-3 py-1.5">
        <FieldLabel htmlFor="theme-agent-avatars">Show agent avatars</FieldLabel>
        <Switch id="theme-agent-avatars" checked={theme.node.showAgentAvatarInNode} disabled={disabled} onCheckedChange={(checked) => onChange({ ...theme, node: { ...theme.node, showAgentAvatarInNode: checked } })} />
      </Field>
    </ThemeControlSection>
  );
}

export function LoopThemeEdgeControls(props: ControlsProps) {
  const { theme, previewTheme, errors, disabled = false, onChange, onColorChange } = props;
  const setStyle = (key: "style" | "rejectedStyle" | "crossLoopStyle", style: string) => onChange({
    ...theme,
    edge: { ...theme.edge, [key]: style as LoopEdgeLineStyle }
  });

  return (
    <ThemeControlSection title="Edge">
      <div className="grid gap-3 sm:grid-cols-2">
        <ThemeColorField label="Color" value={theme.edge.color} previewValue={previewTheme.edge.color} error={errors["edge.color"]} disabled={disabled} onChange={(value) => onColorChange("edge.color", value)} />
        <ThemeColorField label="Label font color" value={theme.edge.labelColor} previewValue={previewTheme.edge.labelColor} error={errors["edge.labelColor"]} disabled={disabled} onChange={(value) => onColorChange("edge.labelColor", value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField label="Normal style" density="compact" value={theme.edge.style} options={lineStyleOptions} disabled={disabled} onChange={(value) => setStyle("style", value)} />
        <SelectField label="Rejected style" density="compact" value={theme.edge.rejectedStyle} options={lineStyleOptions} disabled={disabled} onChange={(value) => setStyle("rejectedStyle", value)} />
        <SelectField label="Cross-Loop style" density="compact" value={theme.edge.crossLoopStyle} options={lineStyleOptions} disabled={disabled} onChange={(value) => setStyle("crossLoopStyle", value)} />
      </div>
    </ThemeControlSection>
  );
}

export function LoopThemeConnectionControls(props: ControlsProps) {
  const { theme, previewTheme, errors, disabled = false, onChange, onColorChange } = props;
  return (
    <ThemeControlSection title="Connection point">
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Style" density="compact" value={theme.connectionPoint.style} options={connectionStyleOptions} disabled={disabled} onChange={(value) => onChange({ ...theme, connectionPoint: { ...theme.connectionPoint, style: value as LoopConnectionPointStyle } })} />
        <ThemeColorField label="Color" value={theme.connectionPoint.color} previewValue={previewTheme.connectionPoint.color} error={errors["connectionPoint.color"]} disabled={disabled} onChange={(value) => onColorChange("connectionPoint.color", value)} />
      </div>
    </ThemeControlSection>
  );
}

function ThemeControlSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid content-start gap-3 border-t border-divider-strong bg-panel-section p-4 first:border-t-0 lg:border-t-0 lg:border-l lg:first:border-l-0">
      <h2 className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-section-heading">{title}</h2>
      {children}
    </section>
  );
}
