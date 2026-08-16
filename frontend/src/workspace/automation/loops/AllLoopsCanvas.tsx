import {
  defaultLoopTheme,
  type ExecutionProfile,
  type LocalRuntime,
  type LoopTheme,
  type ProjectAutomationConfig,
  type ProjectInstruction,
  type ProjectLoopOrchestrator,
  type Skill
} from "@shared/api/workspace-contracts";
import { CollectionCardGrid } from "@/components/shared/workspace-ui";
import { LoopOrchestratorEditor } from "./LoopOrchestratorEditor";
import { LoopOverviewCard } from "./LoopOverviewCard";

export function AllLoopsCanvas({
  config,
  onAddLoop,
  onOpenLoop,
  onDeleteLoop,
  executionProfiles,
  instructions,
  skills,
  runtime,
  onOrchestratorChange,
  theme = defaultLoopTheme,
  lockedLoopIds,
  disabled = false
}: {
  config: ProjectAutomationConfig;
  onAddLoop: () => void;
  onOpenLoop: (loopId: string) => void;
  onDeleteLoop?: (loopId: string) => unknown | Promise<unknown>;
  executionProfiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  runtime: LocalRuntime;
  onOrchestratorChange: (orchestrator: ProjectLoopOrchestrator) => void;
  theme?: LoopTheme;
  lockedLoopIds?: ReadonlySet<string>;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 p-4">
      <LoopOrchestratorEditor
        value={config.orchestrator}
        profiles={executionProfiles}
        instructions={instructions}
        skills={skills}
        runtime={runtime}
        disabled={disabled}
        onChange={onOrchestratorChange}
      />
      <CollectionCardGrid label="All loops" addLabel="Add loop" addAriaLabel="+ Add loop" onAdd={onAddLoop}>
      {config.loops.map((loop) => {
        const loopLocked = disabled || lockedLoopIds?.has(loop.id) === true;
        return (
          <LoopOverviewCard
            key={loop.id}
            loop={loop}
            config={config}
            theme={theme}
            locked={loopLocked}
            onOpen={() => onOpenLoop(loop.id)}
            onDelete={onDeleteLoop ? () => onDeleteLoop(loop.id) : undefined}
          />
        );
      })}
      </CollectionCardGrid>
    </div>
  );
}
