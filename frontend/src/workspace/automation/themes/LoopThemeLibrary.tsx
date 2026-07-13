import type { AppData } from "@shared/api/workspace-contracts";
import { ArrowLeft, Edit3, Palette } from "lucide-react";
import { Panel } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import { automationAllLoopsPath, automationThemePath } from "../../routing";
import type { WorkspaceNavigation } from "../../useWorkspaceNavigation";

export function LoopThemeLibrary({ data, navigate }: {
  data: AppData;
  navigate: WorkspaceNavigation["navigate"];
}) {
  return (
    <Panel
      title="Theme library"
      icon={<Palette />}
      contentClassName="p-0"
      action={<Button type="button" variant="ghost" size="sm" onClick={() => navigate(automationAllLoopsPath())}><ArrowLeft /> All loops</Button>}
    >
      {data.loopThemes.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No Loop themes configured.</p> : (
        <div className="grid gap-px bg-divider-strong sm:grid-cols-2 xl:grid-cols-3" aria-label="Loop theme library">
          {data.loopThemes.map((theme) => {
            const loops = data.automation.loops.filter((loop) => loop.theme === theme.id).map((loop) => loop.id);
            return (
              <article key={theme.id} className="grid min-h-28 bg-card">
                <div className="grid gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-medium text-foreground">{theme.label}</h2>
                      <p className="truncate font-mono text-xs text-muted-foreground">{theme.id}</p>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{loops.length} {loops.length === 1 ? "Loop" : "Loops"}</span>
                  </div>
                  <p className="truncate font-mono text-[0.65rem] text-muted-foreground" title={loops.join(", ")}>
                    {loops.length > 0 ? `Used by: ${loops.join(", ")}` : "Not assigned to a Loop"}
                  </p>
                </div>
                <div className="flex items-center border-t border-divider-strong p-2">
                  <Button type="button" size="sm" variant="outline" className="w-full" aria-label={`Edit theme ${theme.label}`} onClick={() => navigate(automationThemePath(theme.id))}>
                    <Edit3 /> Edit theme
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
