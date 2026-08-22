import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import type { CanvasNodeSize, CanvasNodeStyle, ExecutionProfile, ProjectInstruction } from "@shared/api/workspace-contracts";
import type { ReactNode } from "react";

export interface EngineeringInspectorModel {
  key: string;
  role: string;
  title: string;
  id: string;
  description: string;
  task?: string;
  nodeStyle?: CanvasNodeStyle;
  nodeSize?: CanvasNodeSize;
  executionProfileId?: string;
  primaryInstructionId?: string;
  maxTransitions?: number;
  maxRouteAttempts?: number;
  maxRepairDepth?: number;
  maxRepairAttempts?: number;
  maxRetries?: number;
  accepts?: string[];
  provides?: string[];
  candidates?: Array<{ label: string; values: string[] }>;
  locked?: boolean;
}

export function EngineeringInspector({ model, profiles, instructions, onChange, onClose }: {
  model?: EngineeringInspectorModel;
  profiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  onChange: (field: string, value: string | number) => void;
  onClose: () => void;
}) {
  const mobile = useIsMobile();
  if (!model) return null;
  const content = <InspectorContent model={model} profiles={profiles} instructions={instructions} onChange={onChange} />;
  if (mobile) return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-[92vw] max-w-[24rem] gap-0 border-divider-strong p-0">
        <SheetHeader className="border-b border-divider-strong">
          <SheetTitle>{model.title}</SheetTitle>
          <SheetDescription>{model.role} · {model.id}</SheetDescription>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
  return (
    <aside className="flex min-h-0 w-[23rem] shrink-0 flex-col border-l border-divider-strong bg-card" aria-label={`${model.title} inspector`}>
      <div className="border-b border-divider-strong px-4 py-3">
        <div className="font-heading text-sm font-medium">{model.title}</div>
        <div className="mt-0.5 truncate font-mono text-[0.65rem] text-muted-foreground">{model.role} · {model.id}</div>
      </div>
      {content}
    </aside>
  );
}

function InspectorContent({ model, profiles, instructions, onChange }: {
  model: EngineeringInspectorModel;
  profiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  onChange: (field: string, value: string | number) => void;
}) {
  const disabled = model.locked;
  const instruction = instructions.find((candidate) => candidate.id === model.primaryInstructionId);
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="grid gap-4 p-4">
        {disabled ? <div className="rounded border border-tertiary/40 bg-tertiary/5 p-2 text-xs text-tertiary">Locked while an active Run uses this snapshot.</div> : null}
        <Field label="Description"><Textarea value={model.description} disabled={disabled} className="min-h-20 text-xs" onChange={(event) => onChange("description", event.target.value)} /></Field>
        {model.task !== undefined ? <Field label="Task"><Textarea value={model.task} disabled={disabled} className="min-h-28 text-xs" onChange={(event) => onChange("task", event.target.value)} /></Field> : null}
        {model.nodeStyle ? <div className="grid grid-cols-2 gap-2">
          <Field label="Artwork"><NativeSelect value={model.nodeStyle} disabled={disabled} values={["flat", "luna", "mars", "terra", "sol", "vector-planet"]} onChange={(value) => onChange("nodeStyle", value)} /></Field>
          <Field label="Size"><NativeSelect value={model.nodeSize ?? "medium"} disabled={disabled} values={["tiny", "small", "medium", "large"]} onChange={(value) => onChange("nodeSize", value)} /></Field>
        </div> : null}
        {model.executionProfileId !== undefined ? <Field label="Execution profile">
          <NativeSelect value={model.executionProfileId} disabled={disabled} values={profiles.map((profile) => profile.id)} onChange={(value) => onChange("executionProfileId", value)} />
        </Field> : null}
        {model.primaryInstructionId !== undefined ? <Field label="Primary instruction">
          <NativeSelect value={model.primaryInstructionId} disabled={disabled} values={instructions.flatMap((entry) => entry.id ? [entry.id] : [])} onChange={(value) => onChange("primaryInstructionId", value)} />
        </Field> : null}
        <div className="grid grid-cols-2 gap-2">
          {numberFields.map(({ key, label }) => model[key] !== undefined ? <Field key={key} label={label}>
            <Input type="number" min={0} value={String(model[key])} disabled={disabled} onChange={(event) => onChange(key, Number(event.target.value))} />
          </Field> : null)}
        </div>
        {model.accepts || model.provides ? <div className="grid gap-2 rounded border border-divider-strong bg-background/40 p-3">
          <CapabilityList label="Accepts" values={model.accepts ?? []} />
          <CapabilityList label="Provides" values={model.provides ?? []} />
        </div> : null}
        {model.candidates?.length ? <div className="grid gap-2">
          <div className="font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">Candidate rules</div>
          {model.candidates.map((rule) => <div key={rule.label} className="rounded border border-divider-strong bg-background/40 p-2">
            <div className="truncate font-mono text-[0.65rem] text-tertiary">{rule.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{rule.values.join(" · ")}</div>
          </div>)}
        </div> : null}
        {model.primaryInstructionId ? <div className="grid gap-2 border-t border-divider-strong pt-4">
          <div className="font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">Instruction</div>
          <div className="rounded border border-divider-strong bg-background/50 p-3">
            <div className="mb-2 text-xs font-medium">{instruction?.title ?? model.primaryInstructionId}</div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap font-mono text-[0.6875rem] leading-5 text-muted-foreground">{instruction?.body ?? "Instruction resource is unavailable."}</pre>
          </div>
        </div> : null}
      </div>
    </ScrollArea>
  );
}

const numberFields = [
  { key: "maxTransitions", label: "Transitions" },
  { key: "maxRouteAttempts", label: "Route attempts" },
  { key: "maxRepairDepth", label: "Repair depth" },
  { key: "maxRepairAttempts", label: "Repair attempts" },
  { key: "maxRetries", label: "Retries" }
] as const;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid min-w-0 gap-1.5 text-xs"><span className="font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">{label}</span>{children}</label>;
}
function NativeSelect({ value, values, disabled, onChange }: { value: string; values: string[]; disabled?: boolean; onChange: (value: string) => void }) {
  return <select value={value} disabled={disabled} className="h-8 min-w-0 rounded border border-input bg-background px-2 text-xs" onChange={(event) => onChange(event.target.value)}>{values.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select>;
}
function CapabilityList({ label, values }: { label: string; values: string[] }) {
  return <div><span className="font-mono text-[0.65rem] uppercase text-muted-foreground">{label}</span><div className="mt-1 text-xs text-foreground">{values.length ? values.join(" · ") : "None"}</div></div>;
}
