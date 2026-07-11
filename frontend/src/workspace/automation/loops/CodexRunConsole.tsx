import { useEffect, useMemo, useRef, useState } from "react";
import type { LoopRunDetails, StepRun, StepRunConsoleEntry } from "@shared/api/workspace-contracts";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStepRunConsole } from "./useStepRunConsole";

export function CodexRunConsole({ run, stepRun, onRun }: {
  run: LoopRunDetails;
  stepRun: StepRun;
  onRun: (run: LoopRunDetails) => void;
}) {
  const active = ["running", "waiting_for_human"].includes(run.status) && ["queued", "running", "waiting_for_human"].includes(stepRun.status);
  const { entries, status, error } = useStepRunConsole({ runId: run.runId, stepRunId: stepRun.stepRunId, active, onRun });
  const lines = useMemo(() => mergeConsoleDeltas(entries), [entries]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!follow) return;
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [follow, lines]);

  const copy = async () => {
    await navigator.clipboard.writeText(lines.map((entry) => `[${entry.createdAt}] ${entry.kind.toUpperCase()} ${entry.message}`).join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <section aria-label="Codex runtime console" className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-divider-strong bg-background sm:border-r sm:border-b-0">
      <header className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-divider-strong bg-panel px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex gap-1" aria-hidden>
            <span className="size-2 rounded-full bg-destructive/75" />
            <span className="size-2 rounded-full bg-tertiary/75" />
            <span className="size-2 rounded-full bg-secondary/75" />
          </span>
          <span className="truncate font-mono text-[0.6rem] font-semibold tracking-[0.06em] text-muted-foreground">CODEX RUNTIME CONSOLE</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("border border-divider-strong px-1.5 py-0.5 font-mono text-[0.52rem] uppercase", status === "connected" ? "text-secondary" : status === "reconnecting" ? "text-tertiary" : "text-muted-foreground")}>● {status}</span>
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
        {error ? <ConsoleLine entry={errorEntry(error)} /> : null}
        {lines.length === 0 && !error ? <p className="text-muted-foreground">Waiting for Codex events…</p> : null}
        <div className="grid min-w-max gap-0.5">
          {lines.map((entry) => <ConsoleLine key={entry.id} entry={entry} />)}
        </div>
      </div>
      {!follow ? (
        <button type="button" className="border-t border-divider-strong px-3 py-1 text-left font-mono text-[0.58rem] text-primary" onClick={() => setFollow(true)}>
          Follow latest output
        </button>
      ) : null}
    </section>
  );
}

function ConsoleLine({ entry }: { entry: StepRunConsoleEntry }) {
  return (
    <div className="grid grid-cols-[5.25rem_3.5rem_minmax(0,1fr)] items-start gap-2">
      <time className="text-muted-foreground/70">[{consoleTime(entry.createdAt)}]</time>
      <span className={kindClassName(entry.kind)}>{kindLabel(entry.kind)}</span>
      <pre className="m-0 whitespace-pre text-foreground">{entry.message}</pre>
    </div>
  );
}

function mergeConsoleDeltas(entries: StepRunConsoleEntry[]): StepRunConsoleEntry[] {
  return entries.reduce<StepRunConsoleEntry[]>((lines, entry) => {
    const previous = lines.at(-1);
    if (entry.phase === "delta" && previous?.phase === "delta" && previous.itemId === entry.itemId && previous.kind === entry.kind) {
      lines[lines.length - 1] = { ...previous, id: entry.id, message: previous.message + entry.message, contentBytes: previous.contentBytes + entry.contentBytes };
    } else {
      lines.push(entry);
    }
    return lines;
  }, []);
}

const consoleTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const kindClassName = (kind: StepRunConsoleEntry["kind"]) => cn(
  "font-semibold",
  kind === "system" && "text-primary",
  kind === "think" && "text-tertiary",
  kind === "agent" && "text-secondary",
  kind === "command" && "text-primary",
  kind === "output" && "text-muted-foreground",
  kind === "file" && "text-secondary",
  kind === "tool" && "text-primary",
  kind === "info" && "text-secondary",
  kind === "warn" && "text-tertiary",
  kind === "error" && "text-destructive"
);

const kindLabel = (kind: StepRunConsoleEntry["kind"]) => ({
  system: "SYSTEM",
  think: "THINK",
  agent: "AGENT",
  command: "CMD",
  output: "OUTPUT",
  file: "FILE",
  tool: "TOOL",
  info: "INFO",
  warn: "WARN",
  error: "ERROR"
})[kind];

const errorEntry = (message: string): StepRunConsoleEntry => ({
  id: -1,
  stepRunId: "",
  source: "ballet",
  kind: "error",
  level: "error",
  phase: "completed",
  message,
  contentBytes: message.length,
  terminal: true,
  createdAt: new Date().toISOString()
});
