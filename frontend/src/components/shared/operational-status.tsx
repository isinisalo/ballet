import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusDotVariants = cva("size-1.5 shrink-0 rounded-full", {
  variants: {
    tone: {
      healthy: "bg-secondary",
      attention: "bg-tertiary",
      danger: "bg-destructive",
      neutral: "bg-muted-foreground",
      active: "animate-pulse bg-secondary motion-reduce:animate-none"
    }
  },
  defaultVariants: { tone: "neutral" }
});

export type OperationalStatusTone = NonNullable<VariantProps<typeof statusDotVariants>["tone"]>;

export function StatusDot({ tone = "neutral", className }: { tone?: OperationalStatusTone; className?: string }) {
  return <span aria-hidden="true" data-slot="status-dot" data-tone={tone} className={cn(statusDotVariants({ tone }), className)} />;
}

export function OperationalStatus({ label, tone = "neutral", compact = false, className }: {
  label: string;
  tone?: OperationalStatusTone;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      data-slot="operational-status"
      data-tone={tone}
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-xl border border-border bg-background/30 px-2 text-xs text-foreground",
        compact ? "h-5 font-mono text-[0.68rem]" : "h-6",
        className
      )}
    >
      <StatusDot tone={tone} />
      {label}
    </span>
  );
}
