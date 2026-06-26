export type MainRoute = "overview" | "flows" | "runs" | "agents" | "runtime-console" | "knowledge" | "advanced";
export type AdvancedRoute = "contracts" | "events" | "routing" | "emissions" | "loops" | "runtimes" | "skills";

export interface RouteState {
  main: MainRoute;
  advanced?: AdvancedRoute;
  id?: string;
  version?: number;
}

const advancedRoutes = new Set<AdvancedRoute>(["contracts", "events", "routing", "emissions", "loops", "runtimes", "skills"]);

const versionFromUrl = (url: URL): number | undefined => {
  const value = url.searchParams.get("version");
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const routeFromPath = (path: string): RouteState => {
  const url = new URL(path, "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  const id = parts[1] ? decodeURIComponent(parts[1]) : undefined;
  if (parts[0] === "flows") return { main: "flows", id, version: versionFromUrl(url) };
  if (parts[0] === "runs") return { main: "runs", id };
  if (parts[0] === "agents") return { main: "agents", id };
  if (parts[0] === "runtime-console") return { main: "runtime-console", id };
  if (parts[0] === "knowledge") return { main: "knowledge", id };
  if (parts[0] === "advanced") {
    const advanced = advancedRoutes.has(parts[1] as AdvancedRoute) ? parts[1] as AdvancedRoute : "contracts";
    return { main: "advanced", advanced, id: parts[2] ? decodeURIComponent(parts[2]) : undefined };
  }
  return { main: parts[0] === "overview" || parts.length === 0 ? "overview" : "overview" };
};

export const pathForRoute = (route: RouteState): string => {
  if (route.main === "overview") return "/";
  if (route.main === "runtime-console") return `/runtime-console${route.id ? `/${encodeURIComponent(route.id)}` : ""}`;
  if (route.main === "knowledge") return `/knowledge${route.id ? `/${encodeURIComponent(route.id)}` : ""}`;
  if (route.main === "advanced") return `/advanced/${route.advanced ?? "contracts"}${route.id ? `/${encodeURIComponent(route.id)}` : ""}`;
  const path = `/${route.main}${route.id ? `/${encodeURIComponent(route.id)}` : ""}`;
  return route.main === "flows" && route.version !== undefined ? `${path}?version=${encodeURIComponent(String(route.version))}` : path;
};
