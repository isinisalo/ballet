import { useCallback, useEffect, useState } from "react";
import { routeFromPath } from "./routing";
import type { RouteState } from "./types";

const currentRoutePath = () => `${window.location.pathname}${window.location.search}`;

export const useWorkspaceNavigation = (): { route: RouteState; navigate: (path: string) => void } => {
  const [route, setRoute] = useState<RouteState>(() => routeFromPath(currentRoutePath()));

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, "", path);
    setRoute(routeFromPath(path));
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(routeFromPath(currentRoutePath()));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return { route, navigate };
};
