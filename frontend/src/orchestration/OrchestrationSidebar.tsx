import { Bot, Braces, ClipboardCheck, FileCheck2, FileKey2, Gauge, MessageSquareWarning, Network, Play, Scale, ServerCog, Sparkles, Target } from "lucide-react";
import { Sidebar, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import type { RouteState } from "@/workspace/types";

const groups = [
  ["Automation", [["Loop Engineering", "/automation/loops", Network]]],
  ["Environment", [["Agents", "/agents", Bot], ["Skills", "/skills", Sparkles], ["Runtimes", "/runtimes", ServerCog]]],
  ["Project", [["Goals", "/project/goals", Target], ["ADRs", "/project/adrs", Scale], ["Constraints", "/project/constraints", Gauge], ["Use Cases", "/project/use-cases", FileCheck2], ["Instructions", "/project/instructions", ClipboardCheck]]],
  ["Run", [["Runs", "/run", Play], ["Feedback", "/feedback", MessageSquareWarning], ["Critic reviews", "/reviews/critic", FileKey2], ["Refinement reviews", "/reviews/refinement", Braces]]]
] as const;

export function OrchestrationSidebar({ route, navigate }: { route: RouteState; navigate(path: string): void }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const activePath = typeof window === "undefined" ? "" : window.location.pathname;
  return (
    <Sidebar>
      <div className="border-b border-sidebar-border p-3">
        <div className="font-semibold">Ballet</div><div className="font-mono text-[0.68rem] text-muted-foreground">Validation-led engineering</div>
      </div>
      <nav aria-label="Ballet workspaces" className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-2">
        {groups.map(([title, items]) => (
          <section key={String(title)} aria-label={String(title)}>
            <div className="px-2 py-1 font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground">{String(title)}</div>
            <ul className="flex flex-col gap-0.5">{items.map(([label, path, Icon]) => {
              const active = activePath === path || activePath.startsWith(`${path}/`);
              return <SidebarMenuItem key={path}><SidebarMenuButton aria-current={active ? "page" : undefined} isActive={active} onClick={() => { navigate(path); if (isMobile) setOpenMobile(false); }}><Icon /><span>{label}</span></SidebarMenuButton></SidebarMenuItem>;
            })}</ul>
          </section>
        ))}
      </nav>
      <span className="sr-only">Current workspace {route.workspaceView}</span>
    </Sidebar>
  );
}
