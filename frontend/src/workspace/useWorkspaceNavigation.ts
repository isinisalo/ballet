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

const changesOnlyActionSubview = (currentPath: string, nextPath: string) => {
  const currentUrl = new URL(currentPath, window.location.origin);
  const nextUrl = new URL(nextPath, window.location.origin);
  const currentRoute = routeFromPath(currentPath);
  const nextRoute = routeFromPath(nextPath);
  if (currentRoute.workspaceView !== "action" || nextRoute.workspaceView !== "action" || currentUrl.pathname !== nextUrl.pathname) return false;
  currentUrl.searchParams.delete("agent");
  nextUrl.searchParams.delete("agent");
  return currentUrl.search === nextUrl.search;
};

export interface WorkspaceNavigationBlocker {
  isDirty: boolean;
  message?: string;
}

export interface WorkspaceNavigation {
  route: RouteState;
  navigate: (path: string, options?: { bypassBlocker?: boolean; replace?: boolean }) => void;
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

  const navigate = useCallback((path: string, options?: { bypassBlocker?: boolean; replace?: boolean }) => {
    const url = new URL(path, window.location.origin);
    const nextPath = `${url.pathname}${url.search}`;
    if (nextPath === currentPathRef.current || (!options?.bypassBlocker && !changesOnlyActionSubview(currentPathRef.current, nextPath) && !confirmNavigation())) return;

    const nextHistoryIndex = options?.replace ? currentHistoryIndexRef.current : currentHistoryIndexRef.current + 1;
    window.history[options?.replace ? "replaceState" : "pushState"](indexedHistoryState(nextHistoryIndex), "", path);
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
      if (!changesOnlyActionSubview(currentPathRef.current, nextPath) && !confirmNavigation()) {
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

export const useWorkspaceNavigationBlocker = (
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"],
  isDirty: boolean,
  message: string
) => {
  useEffect(() => {
    setNavigationBlocker({ isDirty, message });
    return () => setNavigationBlocker(null);
  }, [isDirty, message, setNavigationBlocker]);
};
