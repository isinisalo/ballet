import { vi } from "vitest";
import type { AppData, LoopTheme } from "@shared/api/workspace-contracts";

export function installThemeApi(workspace: AppData) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/data") return Response.json(workspace);
    if (url === "/api/project/config-status") return Response.json({ clean: true, changes: [] });
    if (url === "/api/loop-theme" && init?.method === "PUT") {
      workspace.loopTheme = JSON.parse(String(init.body)) as LoopTheme;
      return Response.json(workspace.loopTheme);
    }
    return Response.json({ error: `Unhandled request: ${url}` }, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
