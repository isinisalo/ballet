import { useEffect, useRef, useState } from "react";
import type { InvalidationEvent } from "@shared/orchestration/httpContracts";

export function useOrchestrationInvalidations(refresh: () => Promise<unknown>) {
  const after = useRef(0);
  const [status, setStatus] = useState<"connecting" | "live" | "retrying">("connecting");
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      if (stopped) return;
      setStatus(after.current === 0 ? "connecting" : "retrying");
      const stream = new EventSource(`/api/events?after=${after.current}`);
      stream.onopen = () => setStatus("live");
      stream.addEventListener("invalidation", (message) => {
        const event = JSON.parse((message as MessageEvent<string>).data) as InvalidationEvent;
        if (event.sequence <= after.current) return;
        after.current = event.sequence;
        void refresh();
      });
      stream.onerror = () => { stream.close(); if (!stopped) { setStatus("retrying"); timer = setTimeout(connect, 1_000); } };
    };
    connect();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [refresh]);
  return status;
}
