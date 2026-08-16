import { useEffect, useRef, useState } from "react";
import {
  workspaceInvalidationEventSchema,
  type WorkspaceInvalidationEvent
} from "@shared/api/workspace-contracts";

export type AppStreamStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

type AppStreamCallbacks = {
  onWorkspaceChanged: (event?: Extract<WorkspaceInvalidationEvent, { type: "workspace-changed" }>) => void | Promise<void>;
  onRunsChanged: (event?: Extract<WorkspaceInvalidationEvent, { type: "runs-changed" }>) => void | Promise<void>;
};

const reconnectDelays = [1_000, 2_000, 5_000, 10_000, 15_000];

export function useAppStream(callbacks: AppStreamCallbacks) {
  const callbacksRef = useRef(callbacks);
  const retryRef = useRef(0);
  const timerRef = useRef<number>();
  const sourceRef = useRef<EventSource>();
  const [status, setStatus] = useState<AppStreamStatus>("connecting");

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    let disposed = false;

    const cleanupSource = () => {
      sourceRef.current?.close();
      sourceRef.current = undefined;
    };
    const clearReconnectTimer = () => {
      if (timerRef.current === undefined) return;
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    };
    const connect = () => {
      cleanupSource();
      setStatus(retryRef.current === 0 ? "connecting" : "reconnecting");

      const source = new EventSource("/api/stream");
      sourceRef.current = source;
      source.onopen = () => {
        const reconnected = retryRef.current > 0;
        retryRef.current = 0;
        setStatus("connected");
        if (reconnected) void callbacksRef.current.onRunsChanged();
      };
      source.addEventListener("workspace-changed", (raw) => {
        const event = parseInvalidation(raw, "workspace-changed");
        if (event) void callbacksRef.current.onWorkspaceChanged(event);
      });
      source.addEventListener("runs-changed", (raw) => {
        const event = parseInvalidation(raw, "runs-changed");
        if (event) void callbacksRef.current.onRunsChanged(event);
      });
      source.onerror = () => {
        cleanupSource();
        if (disposed) return;
        const delay = reconnectDelays[Math.min(retryRef.current, reconnectDelays.length - 1)];
        retryRef.current += 1;
        setStatus("reconnecting");
        clearReconnectTimer();
        timerRef.current = window.setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      disposed = true;
      clearReconnectTimer();
      cleanupSource();
      setStatus("disconnected");
    };
  }, []);

  return status;
}

const parseInvalidation = <Type extends WorkspaceInvalidationEvent["type"]>(
  raw: Event,
  type: Type
): Extract<WorkspaceInvalidationEvent, { type: Type }> | undefined => {
  if (!(raw instanceof MessageEvent) || typeof raw.data !== "string") return undefined;
  let value: unknown;
  try { value = JSON.parse(raw.data); } catch { return undefined; }
  const parsed = workspaceInvalidationEventSchema.safeParse(value);
  if (!parsed.success || parsed.data.type !== type) return undefined;
  return parsed.data as Extract<WorkspaceInvalidationEvent, { type: Type }>;
};
