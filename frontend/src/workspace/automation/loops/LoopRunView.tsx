import type {
  ExecutionProfile,
  LoopTheme,
  ProjectAutomationConfig,
  ProjectLoop,
  RootRunDetail
} from "@shared/api/workspace-contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoopCanvas } from "./LoopCanvas";
import type { useLoopRun } from "./useLoopRun";

type LoopRunController = ReturnType<typeof useLoopRun>;

export function LoopRunView({ config, loop, executionProfiles, theme, controller, rootDetail, startDisabledReason }: {
  config: ProjectAutomationConfig;
  loop: ProjectLoop;
  executionProfiles: ExecutionProfile[];
  theme: LoopTheme;
  controller: LoopRunController;
  rootDetail?: RootRunDetail;
  onRootRunChange?: (rootRunId: string) => void;
  startDisabledReason?: string;
}) {
  const details = controller.details;
  const snapshotLoop = rootDetail?.executionSnapshot.loops.find((candidate) => candidate.id === loop.id);
  const canvasLoop = snapshotLoop ?? details?.snapshot ?? loop;
  const canvasConfig = snapshotLoop
    ? { ...config, loops: rootDetail?.executionSnapshot.loops ?? config.loops }
    : config;
  return (
    <div className="grid min-w-0">
      <Alert className="m-4 mb-0">
        <AlertDescription>
          {startDisabledReason ?? "Strict-v10 Work Loop runtime is not implemented in this phase; execution is disabled."}
        </AlertDescription>
      </Alert>
      {controller.error ? (
        <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{controller.error}</AlertDescription></Alert>
      ) : null}
      <LoopCanvas
        config={canvasConfig}
        loop={canvasLoop}
        executionProfiles={rootDetail?.executionSnapshot.executionProfiles ?? executionProfiles}
        theme={rootDetail?.executionSnapshot.theme ?? theme}
        run={details}
        readOnly
      />
    </div>
  );
}
