import type { ReactNode } from "react";
import { PanelTopOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CollectionCardGrid({ label, addLabel, addAriaLabel, onAdd, children }: {
  label: string;
  addLabel: string;
  addAriaLabel?: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={label}>
      <CollectionAddCard label={addLabel} ariaLabel={addAriaLabel} onAdd={onAdd} />
      {children}
    </div>
  );
}

export function CollectionAddCard({ label, ariaLabel = label, onAdd }: {
  label: string;
  ariaLabel?: string;
  onAdd: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={ariaLabel}
      className="grid min-h-36 place-items-center rounded-lg border border-dashed border-muted-foreground/50 bg-background/60 font-mono text-xs text-muted-foreground opacity-60 transition-colors hover:border-primary/65 hover:bg-card hover:text-foreground hover:opacity-85 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      onClick={onAdd}
    >
      + {label}
    </Button>
  );
}

export function CollectionEntityCard({
  icon,
  title,
  identifier,
  status,
  description,
  metadata,
  openLabel,
  onOpen
}: {
  icon: ReactNode;
  title: string;
  identifier: string;
  status?: ReactNode;
  description?: string;
  metadata?: ReactNode;
  openLabel: string;
  onOpen: () => void;
}) {
  return (
    <article className="grid min-h-36 min-w-0 grid-rows-[1fr_auto] overflow-hidden rounded-lg border border-divider-strong bg-card">
      <div className="grid content-start gap-3 p-4">
        <header className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 shrink-0 text-primary [&>svg]:size-4">{icon}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-medium text-foreground">{title}</h2>
            <p className="truncate font-mono text-[0.65rem] text-muted-foreground">{identifier}</p>
          </div>
          {status}
        </header>
        {description ? <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p> : null}
        {metadata ? <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 font-mono text-[0.65rem] text-muted-foreground">{metadata}</div> : null}
      </div>
      <div className="flex items-center border-t border-divider-strong p-2">
        <Button type="button" size="sm" className="w-full" aria-label={openLabel} onClick={onOpen}>
          <PanelTopOpen /> Open
        </Button>
      </div>
    </article>
  );
}
