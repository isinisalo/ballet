import { Ban, CheckCircle, XCircle, type LucideIcon } from "lucide-react";
import type { StepEndStatus } from "@shared/api/workspace-contracts";
import { cn } from "@/lib/utils";

const terminalPresentation: Record<StepEndStatus, { Icon: LucideIcon; className: string }> = {
  completed: { Icon: CheckCircle, className: "border-secondary/75 bg-secondary/10 text-secondary" },
  blocked: { Icon: Ban, className: "border-tertiary/75 bg-tertiary/10 text-tertiary" },
  failed: { Icon: XCircle, className: "border-destructive/75 bg-destructive/10 text-destructive" }
};

export function LoopTerminalNode({
  status,
  interactive = false,
  onClick
}: {
  status: StepEndStatus;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const { Icon, className: statusClassName } = terminalPresentation[status];
  const className = cn(
    "loop-terminal-node nodrag nopan relative flex size-6 items-center justify-center rounded border transition-[border-color,background-color,opacity,box-shadow]",
    statusClassName,
    interactive && "hover:border-primary/75 hover:bg-card focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
  );
  const content = (
    <>
      <Icon aria-hidden="true" className="size-3" strokeWidth={1.9} />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-full left-1/2 mt-2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-background/95 px-1 font-mono text-[0.66rem] leading-4 text-current"
      >
        {status}
      </span>
    </>
  );

  if (!interactive) {
    return (
      <div
        role="img"
        data-loop-output-event={status}
        data-loop-terminal-status={status}
        aria-label={`Terminal target: ${status}`}
        title={status}
        className={className}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-loop-output-event={status}
      data-loop-terminal-status={status}
      aria-label={`Add step before ${status}`}
      title={`Add step before ${status}`}
      onClick={onClick}
      className={className}
    >
      {content}
    </button>
  );
}
