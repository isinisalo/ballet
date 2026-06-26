import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

const toneClass: Record<StatusTone, string> = {
  neutral: "border-white/12 bg-white/6 text-slate-300",
  info: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  danger: "border-red-400/30 bg-red-400/10 text-red-200",
  accent: "border-indigo-400/30 bg-indigo-400/10 text-indigo-200"
};

export function StatusPill({
  children,
  tone = "neutral",
  pulse,
  className
}: {
  children: ReactNode;
  tone?: StatusTone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-sm border px-2 py-1 text-[0.68rem] font-semibold uppercase leading-none tracking-normal", toneClass[tone], className)}>
      <span className={cn("size-1.5 rounded-full bg-current", pulse && "animate-pulse")} />
      {children}
    </span>
  );
}

export const flowHealthTone = (health: "ready" | "warning" | "invalid"): StatusTone =>
  health === "ready" ? "success" : health === "warning" ? "warning" : "danger";
