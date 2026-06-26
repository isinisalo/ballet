import { Bell, Command, RadioTower, Rocket, Search, Zap } from "lucide-react";
import type { AppData } from "backend/shared/domain";
import type { FlowViewModel } from "backend/shared/flow";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/design-system/components/StatusPill";

export function TopBar({
  data,
  flows,
  navigate
}: {
  data: AppData;
  flows: FlowViewModel[];
  navigate: (path: string) => void;
}) {
  const project = data.projects[0];
  const unhealthy = flows.filter((flow) => flow.health !== "ready").length;
  const running = data.agentRuns.filter((run) => run.status === "queued" || run.status === "running" || run.status === "needs_input").length;

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-background/82 px-3 py-3 backdrop-blur-xl md:px-5">
      <div className="mx-auto flex w-full max-w-[92rem] items-center gap-3">
        <div className="hidden min-w-0 md:block">
          <div className="truncate text-sm font-semibold text-foreground">{project?.name ?? "Ballet Workspace"}</div>
          <div className="truncate font-mono text-[0.68rem] uppercase text-muted-foreground">local orchestration runtime</div>
        </div>
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="Search workspace"
            className="h-10 w-full rounded-md border border-white/10 bg-black/20 pl-9 pr-20 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            placeholder="Search flows, agents, ADRs..."
            onKeyDown={(event) => {
              if (event.key === "Enter") navigate("/knowledge");
            }}
          />
          <span className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-sm border border-white/10 px-1.5 py-1 font-mono text-[0.62rem] text-muted-foreground sm:flex">
            <Command className="size-3" />K
          </span>
        </label>
        <StatusPill tone={unhealthy ? "warning" : "success"} pulse={!unhealthy}>
          <RadioTower className="size-3" />
          {unhealthy ? `${unhealthy} warnings` : "connected"}
        </StatusPill>
        <Button type="button" variant="ghost" size="icon" aria-label="Notifications" className="border border-white/10">
          <Bell className="size-4" />
        </Button>
        <Button type="button" variant="outline" className="hidden gap-2 border-cyan-300/30 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15 md:inline-flex" onClick={() => navigate("/runtime-console")}>
          <Zap className="size-4" />
          {running ? `${running} live` : "Console"}
        </Button>
        <Button type="button" className="gap-2" onClick={() => navigate("/flows?create=1")}>
          <Rocket className="size-4" />
          Test
        </Button>
      </div>
    </header>
  );
}
