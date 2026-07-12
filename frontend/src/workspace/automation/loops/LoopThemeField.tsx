import type { LoopTheme, LoopThemeId, ProjectLoop } from "@shared/api/workspace-contracts";
import { Field, FieldLabel } from "@/components/ui/field";
import { LoopEditorSelect } from "./LoopEditorSelect";
import { loopThemeOptions } from "./loopTheme";

export function LoopThemeField({ loop, themes, disabled, onChange }: {
  loop: ProjectLoop;
  themes: readonly LoopTheme[];
  disabled: boolean;
  onChange: (loop: ProjectLoop) => void;
}) {
  return (
    <Field className="gap-1">
      <FieldLabel className="text-xs font-normal text-muted-foreground">Theme</FieldLabel>
      <LoopThemeSelect loop={loop} themes={themes} disabled={disabled} onChange={onChange} />
    </Field>
  );
}

export function LoopThemeSelect({ loop, themes, disabled, onChange }: {
  loop: ProjectLoop;
  themes: readonly LoopTheme[];
  disabled: boolean;
  onChange: (loop: ProjectLoop) => void;
}) {
  return (
    <LoopEditorSelect
      ariaLabel="Loop theme"
      value={loop.theme}
      options={loopThemeOptions(themes)}
      disabled={disabled}
      onChange={(theme) => onChange({ ...loop, theme: theme as LoopThemeId })}
    />
  );
}
