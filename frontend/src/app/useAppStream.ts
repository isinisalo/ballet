import { useEffect, useRef, useState } from "react";

export type AppStreamStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

type AppStreamCallbacks = {
  onWorkspaceChanged: () => void | Promise<void>;
  onRunsChanged: () => void | Promise<void>;
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
        retryRef.current = 0;
        setStatus("connected");
        void Promise.all([
          callbacksRef.current.onWorkspaceChanged(),
          callbacksRef.current.onRunsChanged()
        ]);
      };
      source.addEventListener("workspace-changed", () => {
        void callbacksRef.current.onWorkspaceChanged();
      });
      source.addEventListener("runs-changed", () => {
        void callbacksRef.current.onRunsChanged();
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
