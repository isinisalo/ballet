import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function InspectorDrawer({
  title,
  subtitle,
  children,
  onClose,
  className
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}) {
  return (
    <aside className={cn("grid max-h-[calc(100svh-9rem)] gap-4 overflow-auto rounded-lg border border-white/10 bg-card/90 p-4 shadow-[0_22px_90px_rgba(0,0,0,0.32)]", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.68rem] font-semibold uppercase text-cyan-200/80">Inspector</div>
          <h2 className="mt-1 truncate text-lg font-semibold text-foreground">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{subtitle}</p> : null}
        </div>
        {onClose ? (
          <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Close inspector">
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      {children}
    </aside>
  );
}

export function InspectorSection({
  title,
  children,
  className
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-3 rounded-md border border-white/10 bg-white/[0.035] p-3", className)}>
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      {children}
    </section>
  );
}
