import { useEffect, useRef, useState } from "react";
import { toErrorMessage } from "@/lib/errors";
import { appendConsoleEvents } from "./cliConsoleState";
import { cliConsoleApi } from "./cliConsoleApi";
import type { CliConsoleEvent, CliConsoleStatus } from "./cliConsoleTypes";

const reconnectDelays = [1000, 2000, 5000, 10000];

export function useCliConsole({ taskId, active, onRunEvent, onTerminal }: {
  taskId?: string;
  active: boolean;
  onRunEvent?: (payload: unknown) => void;
  onTerminal?: () => void;
}) {
  const [entries, setEntries] = useState<CliConsoleEvent[]>([]);
  const [status, setStatus] = useState<CliConsoleStatus>(active ? "connecting" : "stored");
  const [error, setError] = useState("");
  const [truncated, setTruncated] = useState(false);
  const cursorRef = useRef(0);
  const callbacksRef = useRef({ onRunEvent, onTerminal });
  callbacksRef.current = { onRunEvent, onTerminal };

  useEffect(() => {
    let disposed = false;
    let source: EventSource | undefined;
    let retryTimer: number | undefined;
    let retry = 0;
    let terminalReceived = false;
    cursorRef.current = 0;
    setEntries([]);
    setError("");
    setTruncated(false);

    if (!taskId) {
      setStatus("disconnected");
      return;
    }

    const append = (event: CliConsoleEvent) => {
      if (event.id <= cursorRef.current) return;
      cursorRef.current = event.id;
      setEntries((current) => {
        const next = appendConsoleEvents(current, [event]);
        if (next.truncated) setTruncated(true);
        return next.entries;
      });
    };

    const connect = () => {
      if (disposed || !active) return;
      setStatus(retry ? "reconnecting" : "connecting");
      source = new EventSource(cliConsoleApi.streamUrl(taskId, cursorRef.current));
      source.onopen = () => { retry = 0; setStatus("connected"); };
      const onConsole = (raw: Event) => append(JSON.parse((raw as MessageEvent<string>).data) as CliConsoleEvent);
      source.onmessage = onConsole;
      source.addEventListener("console", onConsole);
      const onStatus = (raw: Event) => {
        const payload = JSON.parse((raw as MessageEvent<string>).data) as unknown;
        callbacksRef.current.onRunEvent?.(payload);
        const candidate = payload && typeof payload === "object" && "run" in payload
          ? (payload as { run?: unknown }).run
          : payload;
        const status = candidate && typeof candidate === "object" && "status" in candidate
          ? (candidate as { status?: unknown }).status
          : undefined;
        if (["succeeded", "failed", "cancelled"].includes(String(status))) {
          terminalReceived = true;
          source?.close();
          setStatus("stored");
          callbacksRef.current.onTerminal?.();
        }
      };
      source.addEventListener("run", onStatus);
      source.addEventListener("task", onStatus);
      source.onerror = () => {
        source?.close();
        if (disposed) return;
        setStatus("reconnecting");
        const delay = reconnectDelays[Math.min(retry, reconnectDelays.length - 1)];
        retry += 1;
        if (retryTimer) window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    const load = async () => {
      try {
        let page = await cliConsoleApi.getEvents(taskId);
        while (!disposed) {
          page.entries.forEach(append);
          setTruncated((current) => current || page.truncated);
          if (!page.hasMore) break;
          page = await cliConsoleApi.getEvents(taskId, page.lastId);
        }
        if (!disposed) {
          if (active && !terminalReceived) connect();
          else setStatus("stored");
        }
      } catch (caught) {
        if (!disposed) { setError(toErrorMessage(caught, "Unable to load CLI console.")); setStatus("disconnected"); }
      }
    };
    void load();
    return () => { disposed = true; source?.close(); if (retryTimer) window.clearTimeout(retryTimer); };
  }, [active, taskId]);

  return { entries, status, error, truncated };
}
