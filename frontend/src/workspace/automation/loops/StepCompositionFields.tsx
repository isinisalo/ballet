import type { ExecutionProfile, LocalRuntime, ProjectExecutionStep, ProjectInstruction, Skill } from "@shared/api/workspace-contracts";
import { executionProfileBlockingReason } from "../../executionProfiles/executionProfileOptions";
import { CompactSelectField } from "./LoopStepFields";
import { StepSkillsField } from "./StepSkillsField";

export function StepCompositionFields({ step, profiles, instructions, skills, runtime, disabled, onChange }: {
  step: ProjectExecutionStep;
  profiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  runtime: LocalRuntime;
  disabled: boolean;
  onChange: (step: ProjectExecutionStep) => void;
}) {
  const profile = profiles.find((candidate) => candidate.id === step.executionProfileId);
  const profileError = !step.executionProfileId
    ? "Select an execution profile."
    : !profile
      ? `Execution profile ${step.executionProfileId} is missing.`
      : executionProfileBlockingReason(profile, runtime);
  const selectableInstructions = instructions.filter((instruction): instruction is ProjectInstruction & { id: string } => Boolean(instruction.valid && instruction.id));
  const primary = instructions.find((instruction) => instruction.id === step.primaryInstructionId);
  const primaryError = !step.primaryInstructionId
    ? "Select one primary instruction."
    : !primary?.valid
      ? `Primary instruction ${step.primaryInstructionId} is missing or invalid.`
      : undefined;
  const profileOptions = profiles.map((candidate) => ({ value: candidate.id, label: `${candidate.name} · ${candidate.id}` }));
  if (step.executionProfileId && !profile) profileOptions.unshift({ value: step.executionProfileId, label: `${step.executionProfileId} · missing` });
  const instructionOptions = selectableInstructions.map((instruction) => ({ value: instruction.id, label: `${instruction.title} · ${instruction.id} · ${instruction.relativePath ?? "path unavailable"}` }));
  if (step.primaryInstructionId && !primary?.valid) instructionOptions.unshift({ value: step.primaryInstructionId, label: `${step.primaryInstructionId} · unavailable` });

  return (
    <>
      <CompactSelectField
        label="Execution profile"
        ariaLabel="Execution profile"
        value={step.executionProfileId}
        options={profileOptions}
        disabled={disabled || profiles.length === 0}
        invalid={Boolean(profileError)}
        error={profileError}
        onChange={(executionProfileId) => onChange({ ...step, executionProfileId })}
      />
      <CompactSelectField
        label="Primary instruction"
        ariaLabel="Primary instruction"
        value={step.primaryInstructionId}
        options={instructionOptions}
        disabled={disabled || selectableInstructions.length === 0}
        invalid={Boolean(primaryError)}
        error={primaryError}
        onChange={(primaryInstructionId) => onChange({ ...step, primaryInstructionId })}
      />
      <StepSkillsField skillIds={step.skillIds} skills={skills} disabled={disabled} onChange={(skillIds) => onChange({ ...step, skillIds })} />
    </>
  );
}
