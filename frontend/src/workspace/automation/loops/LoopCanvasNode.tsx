import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type LoopNodeTone = "trigger" | "policy" | "agent" | "event";

const loopNodeToneClasses: Record<LoopNodeTone, string> = {
  trigger: "text-tertiary",
  policy: "text-primary",
  agent: "text-secondary",
  event: "text-primary"
};

export function LoopCanvasNode({
  label,
  value,
  tone,
  icon: Icon,
  dashed = false,
  active = false,
  children,
  className
}: {
  label: string;
  value: string;
  tone: LoopNodeTone;
  icon: LucideIcon;
  dashed?: boolean;
  active?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-loop-node
      aria-label={`${label}: ${value}`}
      title={value}
      className={cn(
        "relative grid min-h-9 min-w-44 max-w-60 shrink-0 rounded-md border border-divider-strong bg-card px-2 pb-1.5 pt-3",
        dashed && "border-dashed border-muted-foreground/50 bg-background/60 opacity-60",
        active && "border-primary/80 ring-2 ring-primary/20",
        className
      )}
    >
      <div className={cn("absolute -top-px left-2 flex size-5 -translate-y-[60%] items-center justify-center rounded border border-divider-strong bg-background", loopNodeToneClasses[tone])}>
        <Icon className="size-3.5" aria-hidden="true" />
      </div>
      <div className="grid min-w-0">
        {children ?? <span className="truncate font-mono text-[0.66rem] leading-4 text-foreground">{value}</span>}
      </div>
    </div>
  );
}
