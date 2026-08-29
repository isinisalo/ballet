import { Box, ClipboardCheck, Compass, FileCheck2, ListChecks, MessageSquareWarning, Play, Settings2, Sparkles } from "lucide-react";
import { Sidebar, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import type { RouteState } from "@/workspace/types";

const configure = [
  ["Direction", "/vnext/configure/direction", Compass],
  ["Use Cases", "/vnext/configure/use-cases", FileCheck2],
  ["Environment", "/vnext/configure/environment", ListChecks],
  ["Instructions", "/vnext/configure/resources/instructions", ClipboardCheck],
  ["Skills", "/vnext/configure/resources/skills", Sparkles],
  ["Execution profiles", "/vnext/configure/execution-profiles", Settings2],
  ["Critic", "/vnext/configure/critic", MessageSquareWarning]
] as const;
const run = [
  ["Runs", "/vnext/run", Play], ["Feedback", "/vnext/feedback", MessageSquareWarning],
  ["Critic reviews", "/vnext/reviews/critic", FileCheck2], ["Refinement reviews", "/vnext/reviews/refinement", Sparkles],
  ["Products", "/vnext/products", Box]
] as const;

export function VNextSidebar({ route, navigate }: { route: RouteState; navigate(path: string): void }) {
  const activePath = typeof window === "undefined" ? "" : window.location.pathname;
  return (
    <Sidebar>
      <div className="border-b border-sidebar-border p-3">
        <div className="font-semibold">Ballet</div><div className="font-mono text-[0.68rem] text-muted-foreground">Environment orchestration · vNext</div>
      </div>
      <nav aria-label="vNext workspaces" className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-2">
        {[["Configure", configure], ["Run", run]].map(([title, items]) => (
          <section key={String(title)} aria-label={String(title)}>
            <div className="px-2 py-1 font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground">{String(title)}</div>
            <ul className="flex flex-col gap-0.5">{(items as typeof configure).map(([label, path, Icon]) => (
              <SidebarMenuItem key={path}><SidebarMenuButton isActive={activePath === path || activePath.startsWith(`${path}/`)} onClick={() => navigate(path)}><Icon /><span>{label}</span></SidebarMenuButton></SidebarMenuItem>
            ))}</ul>
          </section>
        ))}
      </nav>
      <span className="sr-only">Current workspace {route.vNextView}</span>
    </Sidebar>
  );
}
