import type { InstalledLoopModuleStatus, ProjectLoop } from "@shared/api/workspace-contracts";
import { Download, PanelTopOpen } from "lucide-react";
import { DeleteAction } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import { LoopRouteArtwork } from "./LoopRouteArtwork";

export function LoopOverviewCard({ loop, locked, installed, onOpen, onExport, onDelete }: {
  loop: ProjectLoop;
  locked: boolean;
  installed?: InstalledLoopModuleStatus;
  onOpen: () => void;
  onExport?: () => unknown | Promise<unknown>;
  onDelete?: () => unknown | Promise<unknown>;
}) {
  return (
    <article className="grid min-h-40 min-w-0 grid-rows-[1fr_auto] overflow-hidden rounded-lg border border-divider-strong bg-card" aria-labelledby={`loop-${loop.id}-heading`}>
      <header className="grid content-start gap-2 p-4">
        <div className="flex min-w-0 items-center gap-2 font-mono text-xs text-foreground"><LoopRouteArtwork size={24} className="text-primary" /><h2 id={`loop-${loop.id}-heading`} className="truncate">{loop.id}</h2></div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{loop.description}</p>
        {installed ? <span className="font-mono text-[0.62rem] text-primary">{installed.title} · v{installed.moduleVersion} · {installed.status}</span> : <span className="font-mono text-[0.62rem] text-muted-foreground">Custom Loop</span>}
      </header>
      <footer className="flex items-center gap-2 border-t border-divider-strong p-2">
        <Button type="button" size="sm" className="flex-1" aria-label={`Open loop ${loop.id}`} onClick={onOpen}><PanelTopOpen /> Open</Button>
        {onExport ? <Button type="button" size="sm" variant="outline" disabled={locked} aria-label={`Export loop ${loop.id} as module`} onClick={onExport}><Download /> Export</Button> : null}
        {onDelete ? <DeleteAction deleteLabel={`${installed ? "Remove installed" : "Delete"} loop ${loop.id}`} deleteType="loop" resourceName={loop.id} disabled={locked} onDelete={onDelete} /> : null}
      </footer>
    </article>
  );
}
