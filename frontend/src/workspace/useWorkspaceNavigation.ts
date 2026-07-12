import { useCallback, useEffect, useRef, useState } from "react";
import { routeFromPath } from "./routing";
import type { RouteState } from "./types";

const currentRoutePath = () => `${window.location.pathname}${window.location.search}`;
const defaultNavigationBlockerMessage = "Discard unsaved changes?";
const historyIndexKey = "__balletWorkspaceIndex";

const historyIndex = (): number | undefined => {
  const value = window.history.state?.[historyIndexKey];
  return typeof value === "number" ? value : undefined;
};

const indexedHistoryState = (index: number) => ({
  ...(window.history.state && typeof window.history.state === "object" ? window.history.state : {}),
  [historyIndexKey]: index
});

const ensureHistoryIndex = () => {
  const existing = historyIndex();
  if (existing !== undefined) return existing;
  window.history.replaceState(indexedHistoryState(0), "", currentRoutePath());
  return 0;
};

export interface WorkspaceNavigationBlocker {
  isDirty: boolean;
  message?: string;
}

export interface WorkspaceNavigation {
  route: RouteState;
  navigate: (path: string) => void;
  setNavigationBlocker: (blocker: WorkspaceNavigationBlocker | null) => void;
}

export const useWorkspaceNavigation = (): WorkspaceNavigation => {
  const [route, setRoute] = useState<RouteState>(() => routeFromPath(currentRoutePath()));
  const [initialHistoryIndex] = useState(ensureHistoryIndex);
  const currentPathRef = useRef(currentRoutePath());
  const currentHistoryIndexRef = useRef(initialHistoryIndex);
  const restoringHistoryRef = useRef(false);
  const blockerRef = useRef<WorkspaceNavigationBlocker | null>(null);

  const setNavigationBlocker = useCallback((blocker: WorkspaceNavigationBlocker | null) => {
    blockerRef.current = blocker;
  }, []);

  const confirmNavigation = useCallback(() => {
    const blocker = blockerRef.current;
    return !blocker?.isDirty || window.confirm(blocker.message ?? defaultNavigationBlockerMessage);
  }, []);

  const navigate = useCallback((path: string) => {
    const url = new URL(path, window.location.origin);
    const nextPath = `${url.pathname}${url.search}`;
    if (nextPath === currentPathRef.current || !confirmNavigation()) return;

    const nextHistoryIndex = currentHistoryIndexRef.current + 1;
    window.history.pushState(indexedHistoryState(nextHistoryIndex), "", path);
    currentHistoryIndexRef.current = nextHistoryIndex;
    currentPathRef.current = nextPath;
    setRoute(routeFromPath(path));
  }, [confirmNavigation]);

  useEffect(() => {
    const onPopState = () => {
      if (restoringHistoryRef.current) {
        restoringHistoryRef.current = false;
        return;
      }
      const nextPath = currentRoutePath();
      if (nextPath === currentPathRef.current) return;
      if (!confirmNavigation()) {
        const nextHistoryIndex = historyIndex();
        if (nextHistoryIndex !== undefined && nextHistoryIndex !== currentHistoryIndexRef.current) {
          restoringHistoryRef.current = true;
          window.history.go(currentHistoryIndexRef.current - nextHistoryIndex);
        } else {
          window.history.replaceState(indexedHistoryState(currentHistoryIndexRef.current), "", currentPathRef.current);
        }
        return;
      }

      const nextHistoryIndex = historyIndex();
      if (nextHistoryIndex !== undefined) currentHistoryIndexRef.current = nextHistoryIndex;
      currentPathRef.current = nextPath;
      setRoute(routeFromPath(nextPath));
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!blockerRef.current?.isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [confirmNavigation]);

  return { route, navigate, setNavigationBlocker };
};
