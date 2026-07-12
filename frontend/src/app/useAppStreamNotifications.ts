import { useEffect, useRef } from "react";
import type { NotificationItem } from "./notifications";
import type { AppStreamStatus } from "./useAppStream";

type Notify = (input: { type: "info" | "error"; message: string }) => string;

export function useAppStreamNotifications({
  notifications,
  notify,
  streamStatus
}: {
  notifications: NotificationItem[];
  notify: Notify;
  streamStatus: AppStreamStatus;
}) {
  const notificationRef = useRef<{ status: "reconnecting" | "disconnected"; id: string } | null>(null);

  useEffect(() => {
    if (streamStatus !== "reconnecting" && streamStatus !== "disconnected") {
      notificationRef.current = null;
      return;
    }

    const current = notificationRef.current;
    const visible = current ? notifications.some((notification) => notification.id === current.id) : false;
    if (current?.status === streamStatus && visible) return;

    const id = notify({
      type: streamStatus === "disconnected" ? "error" : "info",
      message: `App stream ${streamStatus}. Live updates will resume automatically.`
    });
    notificationRef.current = { status: streamStatus, id };
  }, [notifications, notify, streamStatus]);
}
