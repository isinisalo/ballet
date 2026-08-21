import type {
  ExecutionProfile,
  LocalRuntime,
  ProjectInstruction,
  ProjectLoopOrchestrator,
  ProjectLoopRepairRouter,
  Skill
} from "@shared/api/workspace-contracts";
import { GitBranch, Wrench } from "lucide-react";
import { TextField } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import { ExecutionCompositionFields } from "./ExecutionCompositionFields";

export function LoopOrchestratorEditor({ value, profiles, instructions, skills, runtime, disabled, onChange }: {
  value: ProjectLoopOrchestrator;
  profiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  runtime: LocalRuntime;
  disabled: boolean;
  onChange: (value: ProjectLoopOrchestrator) => void;
}) {
  const router = value.repairRouter;
  const canEnable = Boolean(profiles[0] && instructions[0]);
  return <section aria-labelledby="orchestrator-heading" className="grid gap-4">
    <div className="grid gap-2 border-b border-divider-strong pb-4">
      <div className="flex items-center gap-2"><GitBranch className="size-4 text-primary" /><h2 id="orchestrator-heading" className="font-mono text-sm font-semibold">RunBook Orchestrator</h2></div>
      <p className="text-xs leading-5 text-muted-foreground">Mode <span className="font-mono text-foreground">runbook</span> resolves an exact immutable <span className="font-mono">source + decision + outcome</span> key. Normal flow never asks an agent to choose a target.</p>
    </div>
    <div className="grid gap-3 rounded-md border border-divider-strong bg-card p-3">
      <div className="flex items-center gap-2"><Wrench className="size-4 text-tertiary" /><h3 className="font-mono text-xs font-semibold uppercase tracking-[0.08em]">Optional repair router</h3></div>
      {!router ? <>
        <p className="text-xs text-muted-foreground">Disabled. Required only when the Graph contains repair edges.</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || !canEnable}
          onClick={() => onChange({ ...value, repairRouter: defaultRouter(profiles, instructions) })}
        ><Wrench /> Enable repair router</Button>
      </> : <>
        <ExecutionCompositionFields
          roleLabel="Repair router"
          value={router}
          profiles={profiles}
          instructions={instructions}
          skills={skills}
          runtime={runtime}
          disabled={disabled}
          onChange={(composition) => onChange({ ...value, repairRouter: { ...router, ...composition } })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Maximum repair depth"
            type="number"
            value={router.maxRepairDepth}
            error={Number.isInteger(router.maxRepairDepth) && router.maxRepairDepth >= 0 && router.maxRepairDepth <= 32 ? undefined : "Enter an integer from 0 to 32."}
            required disabled={disabled} density="compact"
            onChange={(maxRepairDepth) => onChange({ ...value, repairRouter: { ...router, maxRepairDepth: Number(maxRepairDepth) } })}
          />
          <TextField
            label="Maximum repair attempts"
            type="number"
            value={router.maxRepairAttempts}
            error={Number.isInteger(router.maxRepairAttempts) && router.maxRepairAttempts >= 1 && router.maxRepairAttempts <= 100 ? undefined : "Enter an integer from 1 to 100."}
            required disabled={disabled} density="compact"
            onChange={(maxRepairAttempts) => onChange({ ...value, repairRouter: { ...router, maxRepairAttempts: Number(maxRepairAttempts) } })}
          />
        </div>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => {
          onChange({ mode: "runbook", maxTransitions: value.maxTransitions });
        }}>Disable repair router</Button>
      </>}
    </div>
  </section>;
}

const defaultRouter = (
  profiles: ExecutionProfile[],
  instructions: ProjectInstruction[]
): ProjectLoopRepairRouter => ({
  executionProfileId: profiles[0]?.id ?? "",
  primaryInstructionId: instructions[0]?.id ?? "",
  skillIds: [],
  maxRepairDepth: 3,
  maxRepairAttempts: 3
});
