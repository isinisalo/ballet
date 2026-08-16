import {
  type ExecutionProfile,
  type InstalledLoopModuleStatus,
  type LocalRuntime,
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
  lockedLoopIds,
  disabled = false,
  installedModules = [],
  onExportLoop,
  onRemoveInstalledLoop
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
  lockedLoopIds?: ReadonlySet<string>;
  disabled?: boolean;
  installedModules?: InstalledLoopModuleStatus[];
  onExportLoop?: (loopId: string) => unknown | Promise<unknown>;
  onRemoveInstalledLoop?: (loopId: string) => unknown | Promise<unknown>;
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
        const installed = installedModules.find((candidate) => candidate.loopId === loop.id);
        return (
          <LoopOverviewCard
            key={loop.id}
            loop={loop}
            locked={loopLocked}
            installed={installed}
            onOpen={() => onOpenLoop(loop.id)}
            onExport={onExportLoop ? () => onExportLoop(loop.id) : undefined}
            onDelete={installed && onRemoveInstalledLoop
              ? () => onRemoveInstalledLoop(loop.id)
              : onDeleteLoop ? () => onDeleteLoop(loop.id) : undefined}
          />
        );
      })}
      </CollectionCardGrid>
    </div>
  );
}
