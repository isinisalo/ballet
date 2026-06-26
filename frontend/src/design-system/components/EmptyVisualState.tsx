import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

export function EmptyVisualState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center gap-3 rounded-lg border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
      <div className="grid size-10 place-items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
        <Sparkles className="size-5" />
      </div>
      <div className="grid gap-1">
        <p className="font-medium text-slate-100">{title}</p>
        {description ? <p className="max-w-md text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
