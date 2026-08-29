import { useEffect, useRef } from "react";
import type { VNextInvalidationEvent } from "@shared/vnext/httpContracts";

export function useVNextInvalidations(refresh: () => Promise<unknown>) {
  const after = useRef(0);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      if (stopped) return;
      const stream = new EventSource(`/api/vnext/events?after=${after.current}`);
      stream.addEventListener("invalidation", (message) => {
        const event = JSON.parse((message as MessageEvent<string>).data) as VNextInvalidationEvent;
        if (event.sequence <= after.current) return;
        after.current = event.sequence;
        void refresh();
      });
      stream.onerror = () => { stream.close(); if (!stopped) timer = setTimeout(connect, 1_000); };
    };
    connect();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [refresh]);
}
