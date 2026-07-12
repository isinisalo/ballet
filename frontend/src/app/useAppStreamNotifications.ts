import { useEffect, useRef } from "react";
import type { AppStreamStatus } from "./useAppStream";

type Notify = (input: { type: "info" | "error"; message: string }) => string;

export function useAppStreamNotifications({
  notify,
  streamStatus
}: {
  notify: Notify;
  streamStatus: AppStreamStatus;
}) {
  const notifiedStatusRef = useRef<"reconnecting" | "disconnected" | null>(null);

  useEffect(() => {
    if (streamStatus !== "reconnecting" && streamStatus !== "disconnected") {
      notifiedStatusRef.current = null;
      return;
    }

    if (notifiedStatusRef.current === streamStatus) return;

    notify({
      type: streamStatus === "disconnected" ? "error" : "info",
      message: `App stream ${streamStatus}. Live updates will resume automatically.`
    });
    notifiedStatusRef.current = streamStatus;
  }, [notify, streamStatus]);
}
