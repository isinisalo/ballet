import { Fragment } from "react";
import { Bot, Braces, ClipboardCheck, FileCheck2, FileKey2, Gauge, MessageSquareWarning, Network, Play, Scale, ServerCog, Sparkles, Target } from "lucide-react";
import { Sidebar, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import type { RouteState } from "@/workspace/types";
import { orchestrationEntityPath } from "@/workspace/routing";
import type { OrchestrationConfigureData } from "./types";

const groups = [
  ["Automation", [["Loop Engineering", "/automation/loops", Network]]],
  ["Environment", [["Agents", "/agents", Bot], ["Skills", "/skills", Sparkles], ["Runtimes", "/runtimes", ServerCog]]],
  ["Project", [["Goals", "/project/goals", Target], ["ADRs", "/project/adrs", Scale], ["Constraints", "/project/constraints", Gauge], ["Use Cases", "/project/use-cases", FileCheck2], ["Instructions", "/project/instructions", ClipboardCheck]]],
  ["Run", [["Runs", "/run", Play], ["Feedback", "/feedback", MessageSquareWarning], ["Critic reviews", "/reviews/critic", FileKey2], ["Refinement reviews", "/reviews/refinement", Braces]]]
] as const;

export function OrchestrationSidebar({ route, data, navigate }: { route: RouteState; data?: OrchestrationConfigureData; navigate(path: string): void }) {
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
              const entities = entityItems(path, data);
              return <Fragment key={path}><SidebarMenuItem><SidebarMenuButton aria-current={active && !route.entityId ? "page" : undefined} isActive={active} onClick={() => { navigate(path); if (isMobile) setOpenMobile(false); }}><Icon /><span>{label}</span></SidebarMenuButton></SidebarMenuItem>{active && entities.length ? <li><ul className="ml-5 border-l border-sidebar-border/70 pl-2">{entities.map((entity) => <li key={entity.id}><button className="flex min-h-10 w-full min-w-0 items-center gap-2 rounded-sm px-2 text-left text-xs hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring md:min-h-7" aria-current={route.entityId === entity.id ? "page" : undefined} onClick={() => { navigate(orchestrationEntityPath(path, entity.id)); if (isMobile) setOpenMobile(false); }}><span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${entity.healthy ? "bg-secondary" : "bg-tertiary"}`} /><span className="min-w-0 flex-1 truncate">{entity.label}</span><span className="sr-only">{entity.status}</span></button></li>)}</ul></li> : null}</Fragment>;
            })}</ul>
          </section>
        ))}
      </nav>
      <span className="sr-only">Current workspace {route.workspaceView}</span>
    </Sidebar>
  );
}

type SidebarEntity = { id: string; label: string; status: string; healthy: boolean };

function entityItems(path: string, data?: OrchestrationConfigureData): SidebarEntity[] {
  if (!data) return [];
  if (path === "/agents") return data.project.config.agents.map((item) => ({ id: item.id, label: item.name, status: item.enabled ? "Enabled" : "Disabled", healthy: item.enabled }));
  if (path === "/skills") return data.skills.map((item) => ({ id: item.id, label: item.id, status: "Skill", healthy: true }));
  if (path === "/project/instructions") return data.instructions.map((item) => ({ id: item.id, label: item.id, status: "Instruction", healthy: true }));
  const values = path === "/project/goals" ? data.project.config.direction.goals : path === "/project/adrs" ? data.project.config.direction.adrs : path === "/project/constraints" ? data.project.config.direction.constraints : path === "/project/use-cases" ? data.project.config.direction.useCases : [];
  return values.map((item) => ({ id: item.id, label: item.name, status: item.status, healthy: item.status === "accepted" || item.status === "approved" }));
}
