import type {
  ExecutionProfile,
  LocalRuntime,
  LoopScheduleState,
  ProjectInstruction,
  ProjectWorkNode,
  Skill
} from "@shared/api/workspace-contracts";
import { isProjectProviderWorkNode } from "@shared/api/workspace-contracts";
import { Bot, BriefcaseBusiness, CalendarClock, UserRound } from "lucide-react";
import { SelectField, TextAreaField } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExecutionCompositionFields } from "./ExecutionCompositionFields";
import { NodeAppearanceFields } from "./NodeAppearanceFields";
import { WorkScheduleEditor } from "./WorkScheduleEditor";
import { changeWorkNodeType } from "./loopEditorState";

export function WorkNodeEditor({ node, isStart, profiles, instructions, skills, runtime, scheduleState, disabled, onChange }: {
  node: ProjectWorkNode;
  isStart: boolean;
  profiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  runtime: LocalRuntime;
  scheduleState?: LoopScheduleState;
  disabled: boolean;
  onChange: (node: ProjectWorkNode) => void;
}) {
  const typeOptions = [
    { value: "agent", label: "Agent" },
    { value: "human", label: "Human" },
    ...(isStart || node.type === "scheduled" ? [{ value: "scheduled", label: "Scheduled" }] : [])
  ];
  const taskError = node.task.trim() ? undefined : "Work task is required.";

  return (
    <section aria-labelledby="work-node-heading" className="grid gap-3 rounded-lg border border-divider-strong bg-card p-3">
      <div className="flex items-center gap-2">
        <BriefcaseBusiness className="size-4 text-primary" aria-hidden="true" />
        <h3 id="work-node-heading" className="font-mono text-xs font-semibold uppercase tracking-[0.08em]">Work Node</h3>
        <span className="ml-auto flex items-center gap-1 font-mono text-[0.62rem] text-muted-foreground">
          {node.type === "agent" ? <Bot className="size-3" /> : node.type === "human" ? <UserRound className="size-3" /> : <CalendarClock className="size-3" />}
          {node.type}
        </span>
      </div>
      <SelectField
        label="Work node type"
        value={node.type}
        options={typeOptions}
        disabled={disabled}
        density="compact"
        onChange={(type) => onChange(changeWorkNodeType(node, type as ProjectWorkNode["type"]))}
      />
      {!isStart && node.type === "scheduled" ? (
        <Alert variant="destructive"><AlertDescription>Scheduled Work is allowed only in the start Work Loop Node.</AlertDescription></Alert>
      ) : null}
      <TextAreaField label="Work task" value={node.task} error={taskError} required disabled={disabled} density="compact" rows={4} maxLength={20_000} onChange={(task) => onChange({ ...node, task })} />
      {isProjectProviderWorkNode(node) ? (
        <ExecutionCompositionFields
          roleLabel="Work"
          value={node}
          profiles={profiles}
          instructions={instructions}
          skills={skills}
          runtime={runtime}
          disabled={disabled}
          onChange={(composition) => onChange({ ...node, ...composition })}
        />
      ) : null}
      {node.type === "scheduled" ? <WorkScheduleEditor node={node} state={scheduleState} disabled={disabled} onChange={onChange} /> : null}
      <NodeAppearanceFields value={node} roleLabel="Work" disabled={disabled} onChange={(appearance) => onChange({ ...node, ...appearance })} />
    </section>
  );
}
