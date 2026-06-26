import { useMemo, useState } from "react";
import { CornerDownLeft, TerminalSquare } from "lucide-react";
import type { AppData } from "backend/shared/domain";
import type { FlowViewModel } from "backend/shared/flow";
import { Button, PageHeader, Section, TechnicalDetails } from "@/components/forms/FormControls";
import { StatusPill } from "@/design-system/components/StatusPill";
import { buildConsoleEntries, type ConsoleEntry, type ConsoleFilter } from "@/features/runtime-console/console-model";

const filters: ConsoleFilter[] = ["all", "system", "event", "routing", "agent", "emission", "loop", "error"];

export function RuntimeConsolePage({
  data,
  flows,
  navigate
}: {
  data: AppData;
  flows: FlowViewModel[];
  navigate: (path: string) => void;
}) {
  const entries = useMemo(() => buildConsoleEntries(data, flows), [data, flows]);
  const [filter, setFilter] = useState<ConsoleFilter>("all");
  const [selected, setSelected] = useState<ConsoleEntry | undefined>(entries[0]);
  const [command, setCommand] = useState("");
  const [responses, setResponses] = useState<ConsoleEntry[]>([]);
  const visible = [...responses, ...entries].filter((entry) => filter === "all" || entry.source === filter || (filter === "error" && entry.level === "error"));

  const runCommand = () => {
    const value = command.trim();
    if (!value) return;
    setCommand("");
    const response = executeCommand(value, flows, data, navigate);
    setResponses((items) => [response, ...items].slice(0, 10));
    setSelected(response);
  };

  return (
    <div className="grid gap-5">
      <PageHeader title="Runtime Console" description="Live operator log with safe Ballet commands, filters, and selected trace details." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.36fr)]">
        <Section className="overflow-hidden border-white/10 bg-card/70">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 font-mono text-xs uppercase text-muted-foreground">
              <TerminalSquare className="size-4 text-cyan-200" />
              Codex Runtime Console
              <StatusPill tone="success" pulse>connected</StatusPill>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {filters.map((item) => (
                <Button key={item} type="button" size="sm" variant={filter === item ? "default" : "outline"} onClick={() => setFilter(item)}>
                  {item}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid max-h-[34rem] gap-1 overflow-auto py-3 font-mono text-xs">
            {visible.map((entry) => (
              <button key={entry.id} type="button" className="grid grid-cols-[8.5rem_5.5rem_minmax(0,1fr)] gap-3 rounded-sm px-2 py-1.5 text-left hover:bg-white/8" onClick={() => setSelected(entry)}>
                <span className="text-muted-foreground">[{new Date(entry.at).toISOString().replace("T", " ").slice(0, 19)}]</span>
                <span className={entry.level === "error" ? "text-red-200" : entry.level === "warn" ? "text-amber-200" : entry.level === "cmd" ? "text-emerald-200" : "text-cyan-200"}>{entry.source.toUpperCase()}</span>
                <span className="truncate text-slate-100">{entry.message}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-white/10 pt-3">
            <span className="font-mono text-cyan-200">$</span>
            <input
              aria-label="Runtime command"
              className="h-10 min-w-0 flex-1 rounded-md border border-white/10 bg-black/20 px-3 font-mono text-sm outline-none focus:border-primary/60"
              placeholder="help, show flows, show agents, show runs, open run <id>, open flow <id>, test flow <id>, clear"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") runCommand();
              }}
            />
            <Button type="button" onClick={runCommand}><CornerDownLeft className="size-4" />Run</Button>
          </div>
        </Section>
        <Section title="Selected Trace" className="border-white/10 bg-card/70">
          {selected ? (
            <div className="grid gap-3">
              <StatusPill tone={selected.level === "error" ? "danger" : selected.level === "warn" ? "warning" : "info"}>{selected.level}</StatusPill>
              <div className="font-medium">{selected.message}</div>
              <div className="font-mono text-xs text-muted-foreground">{selected.id}</div>
              <TechnicalDetails>
                <pre className="max-h-96 overflow-auto rounded-md bg-black/30 p-3 text-xs">{JSON.stringify(selected.payload ?? selected, null, 2)}</pre>
              </TechnicalDetails>
            </div>
          ) : <p className="text-sm text-muted-foreground">Select a console line.</p>}
        </Section>
      </div>
    </div>
  );
}

function executeCommand(command: string, flows: FlowViewModel[], data: AppData, navigate: (path: string) => void): ConsoleEntry {
  const [verb, noun, id] = command.split(/\s+/);
  const at = new Date().toISOString();
  if (command === "clear") return { id: `cmd:${at}`, at, level: "cmd", source: "system", message: "Console response buffer cleared." };
  if (command === "help") return { id: `cmd:${at}`, at, level: "cmd", source: "system", message: "Commands: show flows, show agents, show runs, open run <id>, open flow <id>, retry run <id>, test flow <id>, clear." };
  if (command === "show flows") return { id: `cmd:${at}`, at, level: "cmd", source: "system", message: `${flows.length} flows: ${flows.map((flow) => flow.name).join(", ") || "none"}` };
  if (command === "show agents") return { id: `cmd:${at}`, at, level: "cmd", source: "system", message: `${data.agents.length} agents: ${data.agents.map((agent) => agent.name).join(", ") || "none"}` };
  if (command === "show runs") return { id: `cmd:${at}`, at, level: "cmd", source: "system", message: `${data.agentRuns.length} runs loaded.` };
  if (verb === "open" && noun === "run" && id) {
    navigate(`/runs/${encodeURIComponent(id)}`);
    return { id: `cmd:${at}`, at, level: "cmd", source: "system", message: `Opening run ${id}.`, runId: id };
  }
  if (verb === "open" && noun === "flow" && id) {
    navigate(`/flows/${encodeURIComponent(id)}`);
    return { id: `cmd:${at}`, at, level: "cmd", source: "system", message: `Opening flow ${id}.`, flowId: id };
  }
  if (verb === "retry" && noun === "run" && id) return { id: `cmd:${at}`, at, level: "warn", source: "system", message: `Retry run ${id} is available from the run detail action.`, runId: id };
  if (verb === "test" && noun === "flow" && id) return { id: `cmd:${at}`, at, level: "cmd", source: "system", message: `Open flow ${id} and use the Test action to run validation.`, flowId: id };
  return { id: `cmd:${at}`, at, level: "warn", source: "system", message: `Unknown safe command: ${command}. Type help for supported Ballet commands.` };
}
