import { vi } from "vitest";
import type { AppData, LoopTheme } from "@shared/api/workspace-contracts";

export function installThemeApi(workspace: AppData) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/data") return Response.json(workspace);
    if (url === "/api/project/config-status") return Response.json({ clean: true, changes: [] });
    if (url === "/api/loop-themes" && init?.method === "POST") {
      const request = JSON.parse(String(init.body)) as { theme: LoopTheme; assignToLoopId: string };
      workspace.loopThemes.push(request.theme);
      workspace.automation = {
        ...workspace.automation,
        loops: workspace.automation.loops.map((candidate) => candidate.id === request.assignToLoopId
          ? { ...candidate, theme: request.theme.id }
          : candidate)
      };
      return Response.json({ theme: request.theme, automation: workspace.automation });
    }
    return Response.json({ error: `Unhandled request: ${url}` }, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
