import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "info",
  className
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: "info" | "success" | "warning" | "danger" | "accent";
  className?: string;
}) {
  const toneClass = {
    info: "from-sky-400/18 to-transparent text-sky-200",
    success: "from-emerald-400/18 to-transparent text-emerald-200",
    warning: "from-amber-400/18 to-transparent text-amber-200",
    danger: "from-red-400/18 to-transparent text-red-200",
    accent: "from-indigo-400/18 to-transparent text-indigo-200"
  }[tone];

  return (
    <div className={cn("relative overflow-hidden rounded-lg border border-white/10 bg-card/80 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.24)]", className)}>
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r", toneClass)} />
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <div className="text-[0.68rem] font-semibold uppercase text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold leading-none text-foreground">{value}</div>
        </div>
        {icon ? <div className={cn("grid size-9 place-items-center rounded-md border border-white/10 bg-white/5", toneClass)}>{icon}</div> : null}
      </div>
      {detail ? <div className="mt-3 text-sm leading-5 text-muted-foreground">{detail}</div> : null}
    </div>
  );
}
