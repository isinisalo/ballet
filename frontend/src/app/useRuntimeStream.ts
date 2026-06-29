import { useEffect, useRef, useState } from "react";

export type RuntimeStreamStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

const reconnectDelays = [1000, 2000, 5000, 10000, 15000];

export function useRuntimeStream(onChange: () => void | Promise<void>) {
  const onChangeRef = useRef(onChange);
  const retryRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const sourceRef = useRef<EventSource | undefined>(undefined);
  const [status, setStatus] = useState<RuntimeStreamStatus>("connecting");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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

      const source = new EventSource("/api/runtime/stream");
      sourceRef.current = source;

      source.onopen = () => {
        retryRef.current = 0;
        setStatus("connected");
      };

      source.addEventListener("change", () => {
        void onChangeRef.current();
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
