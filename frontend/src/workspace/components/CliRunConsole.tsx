import { Check, Copy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mergeConsoleDeltas } from "./cliConsoleState";
import type { ExecutionEvent, RuntimeProvider } from "@shared/api/workspace-contracts";
import { useCliConsole } from "./useCliConsole";

type ExecutionEventKind = ExecutionEvent["kind"];

export function CliRunConsole({ taskId, provider, active, onTerminal }: {
  taskId?: string;
  provider?: RuntimeProvider;
  active: boolean;
  onTerminal?: () => void;
}) {
  const console = useCliConsole({ taskId, active, onTerminal });
  const lines = useMemo(() => mergeConsoleDeltas(console.entries), [console.entries]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setFollow(true); }, [taskId]);
  useEffect(() => {
    if (follow && viewportRef.current) viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [follow, lines]);

  const copy = async () => {
    await navigator.clipboard.writeText(lines.map((entry) => `[${entry.createdAt}] ${entry.source.toUpperCase()} ${kindLabel(entry.kind)} ${entry.message}`).join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const runtimeLabel = provider === "copilot" ? "COPILOT CLI" : provider === "codex" ? "CODEX CLI" : "CLI";
  return (
    <section aria-label={`${runtimeLabel} console`} className="flex min-h-0 min-w-0 flex-col overflow-hidden border border-divider-strong bg-background">
      <header className="flex min-h-9 flex-wrap items-center justify-between gap-2 border-b border-divider-strong bg-panel px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex gap-1" aria-hidden><i className="size-2 rounded-full bg-destructive/75" /><i className="size-2 rounded-full bg-tertiary/75" /><i className="size-2 rounded-full bg-secondary/75" /></span>
          <span className="truncate font-mono text-[0.6rem] font-semibold tracking-[0.06em] text-muted-foreground">{runtimeLabel} CONSOLE</span>
          <span className="hidden font-mono text-[0.52rem] text-muted-foreground sm:inline">reasoning summaries only</span>
        </div>
        <div className="flex items-center gap-1.5">
          {console.truncated ? <span className="border border-tertiary/30 px-1.5 py-0.5 font-mono text-[0.52rem] uppercase text-tertiary">1 MB window</span> : null}
          <span className={cn("border border-divider-strong px-1.5 py-0.5 font-mono text-[0.52rem] uppercase", console.status === "connected" ? "text-secondary" : console.status === "reconnecting" ? "text-tertiary" : "text-muted-foreground")}>● {console.status}</span>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Copy console" disabled={lines.length === 0} onClick={() => void copy()}>{copied ? <Check /> : <Copy />}</Button>
        </div>
      </header>
      <div
        ref={viewportRef}
        className="min-h-64 flex-1 overflow-auto p-3 font-mono text-[0.66rem] leading-4"
        onScroll={(event) => {
          const target = event.currentTarget;
          setFollow(target.scrollHeight - target.scrollTop - target.clientHeight < 24);
        }}
      >
        {console.error ? <ConsoleError message={console.error} /> : null}
        {lines.length === 0 && !console.error ? <p className="text-muted-foreground">Waiting for CLI events…</p> : null}
        <div className="grid min-w-max gap-0.5">
          {lines.map((entry) => <ConsoleLine key={entry.id} entry={entry} />)}
        </div>
      </div>
      {!follow ? <button type="button" className="border-t border-divider-strong px-3 py-1 text-left font-mono text-[0.58rem] text-primary" onClick={() => setFollow(true)}>Follow latest output</button> : null}
    </section>
  );
}

function ConsoleLine({ entry }: { entry: ExecutionEvent }) {
  return (
    <div className="grid grid-cols-[5.25rem_3.75rem_3.5rem_minmax(0,1fr)] items-start gap-2">
      <time className="text-muted-foreground/70">[{consoleTime(entry.createdAt)}]</time>
      <span className="text-muted-foreground/70">{entry.source.toUpperCase()}</span>
      <span className={kindClassName(entry.kind)}>{kindLabel(entry.kind)}</span>
      <pre className="m-0 whitespace-pre text-foreground">{entry.message}</pre>
    </div>
  );
}

function ConsoleError({ message }: { message: string }) {
  return <div className="mb-1 grid grid-cols-[5.25rem_3.75rem_3.5rem_minmax(0,1fr)] gap-2"><span /><span className="text-muted-foreground">BALLET</span><strong className="text-destructive">ERROR</strong><span className="text-destructive">{message}</span></div>;
}

const consoleTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
};
const kindLabel = (kind: ExecutionEventKind) => ({ system: "SYSTEM", think: "THINK", agent: "AGENT", command: "CMD", output: "OUTPUT", file: "FILE", tool: "TOOL", info: "INFO", warn: "WARN", error: "ERROR" })[kind];
const kindClassName = (kind: ExecutionEventKind) => cn("font-semibold", ["system", "command", "tool"].includes(kind) && "text-primary", kind === "think" && "text-tertiary", ["agent", "file", "info"].includes(kind) && "text-secondary", kind === "output" && "text-muted-foreground", kind === "warn" && "text-tertiary", kind === "error" && "text-destructive");
