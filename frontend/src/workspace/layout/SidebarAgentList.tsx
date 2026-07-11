import type { Agent, AgentExecutionState } from "@shared/api/workspace-contracts";
import {
  SidebarMenuSub
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { agentDocumentPath } from "../routing";
import { SidebarNavLinkItem } from "./SidebarNavLinkItem";

type SidebarAgentEntity = Pick<Agent, "id" | "name" | "relativePath">;

export function SidebarAgentList({
  agents,
  executionStates,
  activePath,
  navigate
}: {
  agents: SidebarAgentEntity[];
  executionStates: AgentExecutionState[];
  activePath?: string;
  navigate: (path: string) => void;
}) {
  if (agents.length === 0) return null;

  return (
    <SidebarMenuSub>
      {agents.map((agent) => {
        const relativePath = agent.relativePath;
        if (!relativePath) return null;
        const path = agentDocumentPath(relativePath);
        return (
          <SidebarNavLinkItem
            key={agent.id}
            path={path}
            isActive={relativePath === activePath}
            navigate={navigate}
            className="h-6 min-w-0 text-muted-foreground data-active:text-sidebar-accent-foreground"
          >
            <AgentStatusDot status={executionStates.find((state) => state.agentId === agent.id)?.status ?? "unbound"} />
            <span className="truncate">{agent.name}</span>
          </SidebarNavLinkItem>
        );
      })}
    </SidebarMenuSub>
  );
}

function AgentStatusDot({ status }: { status: AgentExecutionState["status"] }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-2 shrink-0 rounded-full",
        status === "running" && "animate-pulse bg-secondary shadow-[0_0_0_3px] shadow-secondary/15",
        ["idle", "busy", "attention"].includes(status) && "bg-tertiary shadow-[0_0_0_3px] shadow-tertiary/10",
        ["unbound", "offline"].includes(status) && "bg-muted-foreground/45"
      )}
    />
  );
}
