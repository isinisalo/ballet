import type {
  ExecutionProfile,
  LocalRuntime,
  ProjectInstruction,
  ProjectLoopOrchestrator,
  Skill
} from "@shared/api/workspace-contracts";
import { Route, Wrench } from "lucide-react";
import { TextField } from "@/components/shared/workspace-ui";
import { ExecutionCompositionFields } from "./ExecutionCompositionFields";
import { LoopRouteArtwork } from "./LoopRouteArtwork";

export function LoopOrchestratorEditor({ value, profiles, instructions, skills, runtime, disabled, onChange }: {
  value: ProjectLoopOrchestrator;
  profiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  runtime: LocalRuntime;
  disabled: boolean;
  onChange: (value: ProjectLoopOrchestrator) => void;
}) {
  return (
    <section aria-labelledby="orchestrator-heading" className="grid gap-4">
      <div className="grid content-start gap-3 border-b border-divider-strong pb-4">
        <div className="flex items-center gap-2">
          <LoopRouteArtwork size={28} className="text-primary" />
          <div><h2 id="orchestrator-heading" className="font-mono text-sm font-semibold">Loop Orchestrator</h2><span className="font-mono text-[0.62rem] uppercase text-muted-foreground">Routing component</span></div>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">Validates Workflow PASS dispatch and repair escalation only through persisted Graph allowlists and immutable Run capabilities. It is outside every Workflow.</p>
        <div className="grid gap-1 font-mono text-[0.65rem] text-muted-foreground">
          <span className="flex items-center gap-1"><Wrench className="size-3" /> FailEdge → external repair escalation</span>
          <span className="flex items-center gap-1"><Route className="size-3" /> Workflow PASS → Graph flow dispatch</span>
          <span className="flex items-center gap-1"><Route className="size-3" /> allowed target Loop → persisted continuation</span>
        </div>
      </div>
      <div className="grid gap-3">
        <ExecutionCompositionFields
          roleLabel="Orchestrator"
          value={value}
          profiles={profiles}
          instructions={instructions}
          skills={skills}
          runtime={runtime}
          disabled={disabled}
          onChange={(composition) => onChange({ ...value, ...composition })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Maximum repair depth"
            type="number"
            value={value.maxRepairDepth}
            error={Number.isInteger(value.maxRepairDepth) && value.maxRepairDepth >= 0 && value.maxRepairDepth <= 32 ? undefined : "Enter an integer from 0 to 32."}
            required disabled={disabled} density="compact"
            onChange={(maxRepairDepth) => onChange({ ...value, maxRepairDepth: Number(maxRepairDepth) })}
          />
          <TextField
            label="Maximum repair attempts"
            type="number"
            value={value.maxRepairAttempts}
            error={Number.isInteger(value.maxRepairAttempts) && value.maxRepairAttempts >= 1 && value.maxRepairAttempts <= 100 ? undefined : "Enter an integer from 1 to 100."}
            required disabled={disabled} density="compact"
            onChange={(maxRepairAttempts) => onChange({ ...value, maxRepairAttempts: Number(maxRepairAttempts) })}
          />
        </div>
      </div>
    </section>
  );
}
