import { cn } from "@/lib/utils";

export function LoopGhostNode({
  ariaLabel,
  disabled = false,
  className,
  onClick
}: {
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-loop-node
      className={cn("block size-[22px] shrink-0 cursor-pointer rounded border border-dashed border-muted-foreground/50 bg-background/60 opacity-60 transition-colors hover:border-primary/65 hover:bg-card hover:opacity-85 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-muted-foreground/50 disabled:hover:bg-background/60", className)}
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={disabled}
      onClick={onClick}
    />
  );
}
