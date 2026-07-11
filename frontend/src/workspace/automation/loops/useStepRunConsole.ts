import { useEffect, useMemo, useRef, useState } from "react";
import type { LoopRunDetails, StepRunConsoleEntry } from "@shared/api/workspace-contracts";
import { api } from "@/api";
import { toErrorMessage } from "@/lib/errors";

export type StepRunConsoleStatus = "connecting" | "connected" | "reconnecting" | "stored" | "disconnected";

export function useStepRunConsole({ runId, stepRunId, active, onRun }: {
  runId?: string;
  stepRunId?: string;
  active: boolean;
  onRun: (run: LoopRunDetails) => void;
}) {
  const [entries, setEntries] = useState<StepRunConsoleEntry[]>([]);
  const [status, setStatus] = useState<StepRunConsoleStatus>(active ? "connecting" : "stored");
  const [error, setError] = useState("");
  const cursorRef = useRef(0);

  useEffect(() => {
    let disposed = false;
    let source: EventSource | undefined;
    cursorRef.current = 0;
    setEntries([]);
    setError("");

    if (!runId || !stepRunId) {
      setStatus("disconnected");
      return;
    }

    const append = (entry: StepRunConsoleEntry) => {
      if (entry.id <= cursorRef.current) return;
      cursorRef.current = entry.id;
      setEntries((current) => [...current, entry]);
    };

    const connect = async () => {
      try {
        let page = await api.getStepRunConsole(runId, stepRunId, 0, 500);
        while (!disposed) {
          page.entries.forEach(append);
          if (!page.hasMore) break;
          page = await api.getStepRunConsole(runId, stepRunId, page.lastId, 500);
        }
        if (disposed || !active) {
          if (!disposed) setStatus("stored");
          return;
        }
        setStatus("connecting");
        source = new EventSource(`/api/loop-runs/${encodeURIComponent(runId)}/steps/${encodeURIComponent(stepRunId)}/console/stream?afterId=${cursorRef.current}`);
        source.onopen = () => setStatus("connected");
        source.addEventListener("console", (event) => append(JSON.parse((event as MessageEvent<string>).data) as StepRunConsoleEntry));
        source.addEventListener("run", (event) => onRun(JSON.parse((event as MessageEvent<string>).data) as LoopRunDetails));
        source.onerror = () => setStatus("reconnecting");
      } catch (caught) {
        if (disposed) return;
        setError(toErrorMessage(caught, "Unable to load the StepRun console."));
        setStatus("disconnected");
      }
    };

    void connect();
    return () => {
      disposed = true;
      source?.close();
    };
  }, [active, onRun, runId, stepRunId]);

  return useMemo(() => ({ entries, status, error }), [entries, error, status]);
}
