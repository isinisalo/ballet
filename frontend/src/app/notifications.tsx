import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const notificationTimeoutMs = 8000;

type NotificationType = "info" | "error";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  createdAt: number;
  pinned: boolean;
}

interface NotificationInput {
  type: NotificationType;
  message: string;
}

interface NotificationContextValue {
  notifications: NotificationItem[];
  notify: (input: NotificationInput) => string;
  dismiss: (id: string) => void;
  pin: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const timersRef = useRef(new Map<string, number>());
  const sequenceRef = useRef(0);

  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    clearTimer(id);
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, [clearTimer]);

  const pin = useCallback((id: string) => {
    clearTimer(id);
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, pinned: true } : notification
      )
    );
  }, [clearTimer]);

  const notify = useCallback((input: NotificationInput) => {
    const id = `${Date.now()}-${sequenceRef.current++}`;
    const notification: NotificationItem = {
      id,
      type: input.type,
      message: input.message,
      createdAt: Date.now(),
      pinned: false
    };

    setNotifications((current) => [notification, ...current]);
    const timer = window.setTimeout(() => dismiss(id), notificationTimeoutMs);
    timersRef.current.set(id, timer);
    return id;
  }, [dismiss]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        window.clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ notifications, notify, dismiss, pin }),
    [dismiss, notifications, notify, pin]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationViewport notifications={notifications} dismiss={dismiss} pin={pin} />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider.");
  return context;
}

function NotificationViewport({
  notifications,
  dismiss,
  pin
}: {
  notifications: NotificationItem[];
  dismiss: (id: string) => void;
  pin: (id: string) => void;
}) {
  if (notifications.length === 0) return null;

  return (
    <ol
      aria-label="Notifications"
      aria-live="polite"
      className="fixed right-4 top-4 z-50 grid w-[min(calc(100vw-2rem),28rem)] gap-2"
    >
      {notifications.map((notification) => (
        <li
          key={notification.id}
          role={notification.type === "error" ? "alert" : "status"}
          tabIndex={0}
          className={cn(
            "grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-lg border border-divider-strong bg-card px-3 py-2.5 text-sm text-card-foreground shadow-lg outline-none transition data-[pinned=true]:ring-1 data-[pinned=true]:ring-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50",
            notification.type === "error" && "text-destructive"
          )}
          data-pinned={notification.pinned}
          onClick={() => pin(notification.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              pin(notification.id);
            }
          }}
        >
          <span className="min-w-0 break-words leading-5">{notification.message}</span>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Dismiss notification"
            title="Dismiss notification"
            className={cn("shrink-0", notification.type === "error" && "text-destructive")}
            onClick={(event) => {
              event.stopPropagation();
              dismiss(notification.id);
            }}
          >
            <X data-icon="inline-start" />
          </Button>
        </li>
      ))}
    </ol>
  );
}
