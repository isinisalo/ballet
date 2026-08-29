import { Box, ClipboardCheck, Compass, FileCheck2, ListChecks, MessageSquareWarning, Play, Settings2, Sparkles } from "lucide-react";
import { Sidebar, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import type { RouteState } from "@/workspace/types";

const configure = [
  ["Direction", "/configure/direction", Compass],
  ["Use Cases", "/configure/use-cases", FileCheck2],
  ["Environment", "/configure/environment", ListChecks],
  ["Instructions", "/configure/resources/instructions", ClipboardCheck],
  ["Skills", "/configure/resources/skills", Sparkles],
  ["Execution profiles", "/configure/execution-profiles", Settings2],
  ["Critic", "/configure/critic", MessageSquareWarning]
] as const;
const run = [
  ["Runs", "/run", Play], ["Feedback", "/feedback", MessageSquareWarning],
  ["Critic reviews", "/reviews/critic", FileCheck2], ["Refinement reviews", "/reviews/refinement", Sparkles],
  ["Products", "/products", Box]
] as const;

export function OrchestrationSidebar({ route, navigate }: { route: RouteState; navigate(path: string): void }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const activePath = typeof window === "undefined" ? "" : window.location.pathname;
  return (
    <Sidebar>
      <div className="border-b border-sidebar-border p-3">
        <div className="font-semibold">Ballet</div><div className="font-mono text-[0.68rem] text-muted-foreground">Environment orchestration</div>
      </div>
      <nav aria-label="Ballet workspaces" className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-2">
        {[["Configure", configure], ["Run", run]].map(([title, items]) => (
          <section key={String(title)} aria-label={String(title)}>
            <div className="px-2 py-1 font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground">{String(title)}</div>
            <ul className="flex flex-col gap-0.5">{(items as typeof configure).map(([label, path, Icon]) => (
              <SidebarMenuItem key={path}><SidebarMenuButton aria-current={activePath === path || activePath.startsWith(`${path}/`) ? "page" : undefined} isActive={activePath === path || activePath.startsWith(`${path}/`)} onClick={() => { navigate(path); if (isMobile) setOpenMobile(false); }}><Icon /><span>{label}</span></SidebarMenuButton></SidebarMenuItem>
            ))}</ul>
          </section>
        ))}
      </nav>
      <span className="sr-only">Current workspace {route.workspaceView}</span>
    </Sidebar>
  );
}
