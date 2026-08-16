import type {
  ExecutionProfile,
  LocalRuntime,
  ProjectExecutionComposition,
  ProjectInstruction,
  Skill
} from "@shared/api/workspace-contracts";
import { SelectField } from "@/components/shared/workspace-ui";
import { executionProfileBlockingReason } from "../../executionProfiles/executionProfileOptions";
import { ExecutionSkillsField } from "./ExecutionSkillsField";

export function ExecutionCompositionFields({
  value,
  roleLabel,
  profiles,
  instructions,
  skills,
  runtime,
  disabled,
  onChange
}: {
  value: ProjectExecutionComposition;
  roleLabel: string;
  profiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  runtime: LocalRuntime;
  disabled: boolean;
  onChange: (value: ProjectExecutionComposition) => void;
}) {
  const profile = profiles.find((candidate) => candidate.id === value.executionProfileId);
  const profileError = !value.executionProfileId
    ? "Select an execution profile."
    : !profile
      ? `Execution profile ${value.executionProfileId} is missing.`
      : executionProfileBlockingReason(profile, runtime);
  const primary = instructions.find((instruction) => instruction.id === value.primaryInstructionId);
  const primaryError = !value.primaryInstructionId
    ? "Select one primary instruction."
    : !primary?.valid
      ? `Primary instruction ${value.primaryInstructionId} is missing or invalid.`
      : undefined;
  const profileOptions = profiles.map((candidate) => ({ value: candidate.id, label: `${candidate.name} · ${candidate.id}` }));
  const instructionOptions = instructions.flatMap((instruction) => instruction.valid && instruction.id
    ? [{ value: instruction.id, label: `${instruction.title} · ${instruction.id}` }]
    : []);
  if (value.executionProfileId && !profile) profileOptions.unshift({ value: value.executionProfileId, label: `${value.executionProfileId} · missing` });
  if (value.primaryInstructionId && !primary?.valid) instructionOptions.unshift({ value: value.primaryInstructionId, label: `${value.primaryInstructionId} · unavailable` });

  return (
    <div className="grid gap-3">
      <SelectField
        label={`${roleLabel} execution profile`}
        value={value.executionProfileId}
        options={profileOptions}
        error={profileError}
        disabled={disabled || profiles.length === 0}
        required
        density="compact"
        onChange={(executionProfileId) => onChange({ ...value, executionProfileId })}
      />
      <SelectField
        label={`${roleLabel} primary instruction`}
        value={value.primaryInstructionId}
        options={instructionOptions}
        error={primaryError}
        disabled={disabled || instructionOptions.length === 0}
        required
        density="compact"
        onChange={(primaryInstructionId) => onChange({ ...value, primaryInstructionId })}
      />
      <ExecutionSkillsField
        label={`${roleLabel} skills`}
        skillIds={value.skillIds}
        skills={skills}
        disabled={disabled}
        onChange={(skillIds) => onChange({ ...value, skillIds })}
      />
    </div>
  );
}
