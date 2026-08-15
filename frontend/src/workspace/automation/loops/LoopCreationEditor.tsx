import type { ReactNode } from "react";
import type {
  ExecutionProfile,
  LocalRuntime,
  LoopTheme,
  ProjectAutomationConfig,
  ProjectInstruction,
  ProjectLoop,
  Skill
} from "@shared/api/workspace-contracts";
import { LoopEditor } from "./LoopEditor";

export function LoopCreationEditor({ config, loop, loops, executionProfiles, instructions, skills, runtime, theme, disabled = false, canvasControls, onChange }: {
  config: ProjectAutomationConfig;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  executionProfiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  runtime: LocalRuntime;
  theme: LoopTheme;
  disabled?: boolean;
  canvasControls?: ReactNode;
  onChange: (loop: ProjectLoop) => void;
}) {
  return <LoopEditor
    config={config}
    loop={loop}
    loops={loops}
    executionProfiles={executionProfiles}
    instructions={instructions}
    skills={skills}
    runtime={runtime}
    theme={theme}
    locked={false}
    disabled={disabled}
    creation
    canvasControls={canvasControls}
    onChange={onChange}
  />;
}
