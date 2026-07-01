import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function WorkflowGhostNode({
  value,
  icon: Icon,
  ariaLabel,
  disabled = false,
  className,
  onClick
}: {
  value: string;
  icon: LucideIcon;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-workflow-node
      className={cn("relative grid min-h-9 min-w-44 max-w-60 shrink-0 cursor-pointer rounded-md border border-dashed border-muted-foreground/70 bg-background/80 px-2 pb-1.5 pt-3 text-left opacity-80 transition-colors hover:border-primary/80 hover:bg-card hover:opacity-100 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-muted-foreground/70 disabled:hover:bg-background/80", className)}
      aria-label={ariaLabel}
      title={value}
      disabled={disabled}
      onClick={onClick}
    >
      <div className="absolute -top-px left-2 flex size-5 -translate-y-[60%] items-center justify-center rounded border border-dashed border-muted-foreground/70 bg-background text-primary">
        <Icon className="size-3.5" aria-hidden="true" />
      </div>
      <span className="truncate font-mono text-[0.66rem] leading-4 text-muted-foreground">{value}</span>
    </button>
  );
}
