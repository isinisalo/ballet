import { act, renderHook, waitFor } from "@testing-library/react";
import type { AppData } from "@shared/api/workspace-contracts";
import { describe, expect, it, vi } from "vitest";
import { useWorkspaceData } from "../src/workspace/data/useWorkspaceData";
import { emptyData } from "../src/workspace/types";

const data = (name: string): AppData => ({ ...emptyData, project: { ...emptyData.project, name } });

describe("workspace data", () => {
  it("ignores an older refresh that completes after a newer one", async () => {
    const responses: Array<(response: Response) => void> = [];
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => responses.push(resolve))));
    const notify = vi.fn();
    const { result } = renderHook(() => useWorkspaceData({ notify }));
    await waitFor(() => expect(responses).toHaveLength(1));

    act(() => { void result.current.refresh(); });
    await waitFor(() => expect(responses).toHaveLength(2));
    await act(async () => responses[1](Response.json(data("newer"))));
    expect(result.current.data.project.name).toBe("newer");

    await act(async () => responses[0](Response.json(data("older"))));
    expect(result.current.data.project.name).toBe("newer");
  });
});
