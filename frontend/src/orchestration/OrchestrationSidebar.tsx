import { Fragment, useState } from "react";
import { Bot, BookOpenText, Braces, ChevronDown, ChevronRight, ClipboardCheck, FileCheck2, FileKey2, Gauge, MessageSquareWarning, Network, Play, Scale, ServerCog, Sparkles, Target } from "lucide-react";
import { Sidebar, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, useSidebar } from "@/components/ui/sidebar";
import type { RouteState } from "@/workspace/types";
import { orchestrationActionPath, orchestrationEntityPath, orchestrationStatePath } from "@/workspace/routing";
import { orderedActions, orderedStates } from "@shared/orchestration/gates";
import type { EnvironmentDefinition } from "@shared/orchestration/environment";
import type { OrchestrationConfigureData } from "./types";
import { actionDisplayName } from "./actionDisplayName";

const groups = [
  ["Automation", [["Loop Engineering", "/automation/loops", Network]]],
  ["Environment", [["Agents", "/agents", Bot], ["Skills", "/skills", Sparkles], ["Runtimes", "/runtimes", ServerCog]]],
  ["Project", [["Goals", "/project/goals", Target], ["ADRs", "/project/adrs", Scale], ["Constraints", "/project/constraints", Gauge], ["Event Storming", "/project/event-storming", Network], ["User Story", "/project/user-stories", BookOpenText], ["Use Cases", "/project/use-cases", FileCheck2], ["Instructions", "/project/instructions", ClipboardCheck]]],
  ["Run", [["Runs", "/run", Play], ["Feedback", "/feedback", MessageSquareWarning], ["Critic reviews", "/reviews/critic", FileKey2], ["Refinement reviews", "/reviews/refinement", Braces]]]
] as const;

export function OrchestrationSidebar({ route, data, navigate }: { route: RouteState; data?: OrchestrationConfigureData; navigate(path: string): void }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const activePath = typeof window === "undefined" ? "" : window.location.pathname;
  const closeMobile = () => { if (isMobile) setOpenMobile(false); };
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
              const loopEngineering = path === "/automation/loops";
              const exactRoot = loopEngineering ? route.workspaceView === "environment" : active && !route.entityId;
              return <Fragment key={path}><SidebarMenuItem><SidebarMenuButton aria-current={exactRoot ? "page" : undefined} isActive={active} onClick={() => { navigate(path); closeMobile(); }}><Icon /><span>{label}</span></SidebarMenuButton></SidebarMenuItem>
                {active && loopEngineering && data ? <LoopEngineeringMenu environment={data.project.config.environment} route={route} navigate={navigate} closeMobile={closeMobile} /> : null}
                {active && !loopEngineering && entities.length ? <li><ul className="ml-5 border-l border-sidebar-border/70 pl-2">{entities.map((entity) => <li key={entity.id}><button className="flex min-h-10 w-full min-w-0 items-center gap-2 rounded-sm px-2 text-left text-xs hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring md:min-h-7" aria-current={route.entityId === entity.id ? "page" : undefined} onClick={() => { navigate(orchestrationEntityPath(path, entity.id)); closeMobile(); }}><span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${entity.healthy ? "bg-secondary" : "bg-tertiary"}`} /><span className="min-w-0 flex-1 truncate">{entity.label}</span><span className="sr-only">{entity.status}</span></button></li>)}</ul></li> : null}</Fragment>;
            })}</ul>
          </section>
        ))}
      </nav>
      <span className="sr-only">Current workspace {route.workspaceView}</span>
    </Sidebar>
  );
}

function LoopEngineeringMenu({ environment, route, navigate, closeMobile }: { environment: EnvironmentDefinition; route: RouteState; navigate(path: string): void; closeMobile(): void }) {
  const [expandedStateIds, setExpandedStateIds] = useState<Set<string>>(() => new Set());
  const toggleState = (stateId: string) => setExpandedStateIds((current) => {
    const next = new Set(current);
    if (next.has(stateId)) next.delete(stateId); else next.add(stateId);
    return next;
  });
  return <li><SidebarMenuSub aria-label="Loop Engineering hierarchy">
    {orderedStates(environment.states).map((state) => {
      const selected = route.stateId === state.id;
      const expanded = selected || expandedStateIds.has(state.id);
      return <SidebarMenuSubItem key={state.id} className="min-w-0">
        <div className="flex min-w-0 gap-1">
          <SidebarMenuSubButton render={<button type="button" />} className="min-h-10 flex-1 md:min-h-7" isActive={selected} aria-label={`Open State ${state.id}: ${state.name}`} aria-current={route.workspaceView === "state" && selected ? "page" : undefined} onClick={() => { navigate(orchestrationStatePath(state.id)); closeMobile(); }}>
            <code className="text-tertiary">S{state.order}</code><span>{state.name}</span>
          </SidebarMenuSubButton>
          <SidebarMenuSubButton render={<button type="button" />} size="sm" className="min-h-10 w-10 shrink-0 justify-center px-0 md:min-h-7 md:w-7" aria-label={selected ? `Actions for selected State ${state.name} are expanded` : `${expanded ? "Collapse" : "Expand"} Actions for State ${state.name}`} aria-expanded={expanded} aria-disabled={selected} tabIndex={selected ? -1 : undefined} onClick={() => { if (!selected) toggleState(state.id); }}>
            {expanded ? <ChevronDown aria-hidden="true" className="size-3.5" /> : <ChevronRight aria-hidden="true" className="size-3.5" />}
          </SidebarMenuSubButton>
        </div>
        {expanded ? <SidebarMenuSub aria-label={`Actions for State ${state.name}`} className="mx-0 ml-3 mr-0 overflow-hidden">
          {orderedActions(state.actions).map((action) => <SidebarMenuSubItem key={action.id} className="min-w-0"><SidebarMenuSubButton render={<button type="button" />} size="sm" className="min-h-10 w-full md:min-h-7" isActive={route.workspaceView === "action" && selected && route.actionId === action.id} aria-label={`Open Action ${action.id}: ${action.name}`} aria-current={route.workspaceView === "action" && selected && route.actionId === action.id ? "page" : undefined} onClick={() => { navigate(orchestrationActionPath(state.id, action.id)); closeMobile(); }}>
            <code className="text-primary">A{action.priority}</code><span>{actionDisplayName(action.name, state.name)}</span>
          </SidebarMenuSubButton></SidebarMenuSubItem>)}
        </SidebarMenuSub> : null}
      </SidebarMenuSubItem>;
    })}
  </SidebarMenuSub></li>;
}

type SidebarEntity = { id: string; label: string; status: string; healthy: boolean };

function entityItems(path: string, data?: OrchestrationConfigureData): SidebarEntity[] {
  if (!data) return [];
  if (path === "/agents") return data.agents.agents.map((item) => ({ id: item.id,
    label: item.id === "ballet-critic-agent" ? "Critic Agent" : "Refinement Agent",
    status: item.status, healthy: item.status === "ready" }));
  if (path === "/skills") return data.skills.map((item) => ({ id: item.id, label: item.id, status: "Skill", healthy: true }));
  if (path === "/project/instructions") return data.instructions.map((item) => ({ id: item.id, label: item.id, status: "Instruction", healthy: true }));
  const values = path === "/project/goals" ? data.project.config.direction.goals : path === "/project/adrs" ? data.project.config.direction.adrs : path === "/project/constraints" ? data.project.config.direction.constraints : path === "/project/use-cases" ? data.project.config.direction.useCases : [];
  return values.map((item) => ({ id: item.id, label: item.name, status: item.status, healthy: item.status === "accepted" || item.status === "approved" }));
}
