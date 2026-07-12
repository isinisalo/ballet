import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RuntimeRegistryView } from "../src/workspace/runtimes/RuntimeRegistryView";
import { localProvider, localRuntime } from "./runtimeFixtures";

describe("local Runtime UI", () => {
  it("shows the checkout and both local CLI capability states without device actions", () => {
    const runtime = localRuntime({
      providers: [
        localProvider(),
        localProvider({ provider: "copilot", command: "/opt/homebrew/bin/copilot", authStatus: "required", health: "auth_required", healthMessage: "GitHub authentication is required." })
      ]
    });
    render(<RuntimeRegistryView runtime={runtime} onRefreshed={vi.fn()} />);

    expect(screen.getByRole("heading", { name: runtime.hostname })).toBeInTheDocument();
    expect(screen.getByText("/workspace/ballet")).toBeInTheDocument();
    expect(screen.getByText("Codex CLI")).toBeInTheDocument();
    expect(screen.getByText("GitHub Copilot CLI")).toBeInTheDocument();
    expect(screen.getByText("Run locally: copilot login")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /connect|disconnect|restart|stop/i })).not.toBeInTheDocument();
  });

  it("refreshes local provider capabilities through the singular runtime endpoint", async () => {
    const user = userEvent.setup();
    const refreshed = localRuntime({ uptimeSeconds: 600 });
    const onRefreshed = vi.fn(async () => undefined);
    const fetchMock = vi.fn(async () => Response.json(refreshed));
    vi.stubGlobal("fetch", fetchMock);
    render(<RuntimeRegistryView runtime={localRuntime()} onRefreshed={onRefreshed} />);

    await user.click(screen.getByRole("button", { name: "Refresh capabilities" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/runtime/refresh", expect.objectContaining({ method: "POST", body: "{}" })));
    expect(onRefreshed).toHaveBeenCalled();
  });

  it("opens the checkout-local Ballet log", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ path: "/workspace/ballet/.git/ballet/logs/ballet.log", content: "runtime ready\n" })));
    render(<RuntimeRegistryView runtime={localRuntime()} onRefreshed={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "View logs" }));
    expect(await screen.findByText("runtime ready", { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText("/workspace/ballet/.git/ballet/logs/ballet.log")).toHaveLength(2);
  });
});
