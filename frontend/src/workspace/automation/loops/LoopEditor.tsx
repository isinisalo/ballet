import type {
  ExecutionProfile,
  LocalRuntime,
  LoopTheme,
  ProjectAutomationConfig,
  ProjectLoop
} from "@shared/api/workspace-contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoopCanvas } from "./LoopCanvas";

export function LoopEditor({ config, loop, executionProfiles, runtime, theme }: {
  config: ProjectAutomationConfig;
  loop: ProjectLoop;
  executionProfiles: ExecutionProfile[];
  runtime: LocalRuntime;
  theme: LoopTheme;
}) {
  return (
    <div className="grid min-w-0">
      <Alert className="m-4 mb-0">
        <AlertDescription>
          Strict-v10 Work Loop configuration is loaded read-only in this phase. The v10 node and edge editor follows in the frontend phase.
        </AlertDescription>
      </Alert>
      <div className="grid gap-1 border-b border-divider-strong px-4 py-3">
        <span className="font-mono text-xs text-foreground">{loop.id}</span>
        <span className="text-xs text-muted-foreground">{loop.description}</span>
        <span className="font-mono text-[0.65rem] text-muted-foreground">state: {loop.state.description}</span>
      </div>
      <LoopCanvas
        config={config}
        loop={loop}
        executionProfiles={executionProfiles}
        runtime={runtime}
        theme={theme}
        readOnly
      />
    </div>
  );
}
