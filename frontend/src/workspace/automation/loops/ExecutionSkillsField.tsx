import { useId } from "react";
import type { Skill } from "@shared/api/workspace-contracts";
import { X } from "lucide-react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { MultiSelect } from "@/components/ui/multi-select";

export const canonicalResourceIds = (ids: readonly string[]) =>
  [...new Set(ids)].sort((left, right) => left.localeCompare(right));

export function ExecutionSkillsField({ skillIds, skills, disabled, label, onChange }: {
  skillIds: string[];
  skills: Skill[];
  disabled: boolean;
  label: string;
  onChange: (skillIds: string[]) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const validSkills = skills.filter((skill) => skill.valid);
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const canonicalIds = canonicalResourceIds(skillIds);
  const invalidIds = canonicalIds.filter((skillId) => !byId.get(skillId)?.valid);
  const update = (nextIds: string[]) => onChange(canonicalResourceIds(nextIds));

  return (
    <Field className="grid gap-1.5" data-invalid={invalidIds.length > 0}>
      <FieldLabel htmlFor={id} className="text-xs font-normal text-muted-foreground">{label}</FieldLabel>
      <div className="grid min-w-0 gap-1.5">
        <MultiSelect
          id={id}
          ariaLabel={label}
          describedBy={invalidIds.length ? errorId : undefined}
          values={canonicalIds.filter((skillId) => byId.get(skillId)?.valid)}
          options={validSkills.map((skill) => ({
            value: skill.id,
            label: skill.name,
            detail: `${skill.origin} · ${skill.id}`
          }))}
          disabled={disabled}
          invalid={invalidIds.length > 0}
          onValuesChange={(nextValidIds) => update([...invalidIds, ...nextValidIds])}
        />
        {canonicalIds.length ? (
          <div className="flex flex-wrap gap-1" aria-label={`Selected ${label.toLowerCase()}`}>
            {canonicalIds.map((skillId) => {
              const skill = byId.get(skillId);
              return (
                <span key={skillId} className={`inline-flex min-w-0 items-center gap-1 rounded-xl border px-2 py-0.5 font-mono text-[0.62rem] ${skill?.valid ? "border-divider-strong bg-background text-foreground" : "border-destructive/50 bg-destructive/5 text-destructive"}`}>
                  <span className="max-w-44 truncate">{skill?.name ?? skillId}</span>
                  <button type="button" disabled={disabled} aria-label={`Remove ${skill?.name ?? skillId} skill`} className="inline-flex size-4 items-center justify-center rounded-full hover:bg-muted disabled:opacity-50" onClick={() => update(canonicalIds.filter((candidate) => candidate !== skillId))}>
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </span>
              );
            })}
          </div>
        ) : null}
        {invalidIds.length ? <FieldError id={errorId} className="text-xs">Missing or invalid skills: {invalidIds.join(", ")}.</FieldError> : null}
      </div>
    </Field>
  );
}
