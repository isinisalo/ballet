import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeRegistryView } from "../src/workspace/runtimes/RuntimeRegistryView";
import { runtimeDevice } from "./runtimeFixtures";

afterEach(() => window.history.replaceState({}, "", "/"));

describe("Runtime Registry UI", () => {
  it("renders searchable computer details without a Stop action", async () => {
    const user = userEvent.setup();
    const device = runtimeDevice();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/runtimes/devices?")) return Response.json({ devices: [device] });
      if (url === "/api/runtimes/devices") return Response.json({ devices: [device] });
      if (url === `/api/runtimes/devices/${device.id}`) return Response.json(device);
      if ([`/api/runtimes/devices/${device.id}/refresh`, `/api/runtimes/devices/${device.id}/restart`].includes(url) && init?.method === "POST") return Response.json(device);
      return Response.json({ error: `Unhandled GET ${url}` }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<RuntimeRegistryView selectedDeviceId={device.id} onSelectDevice={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: device.displayName })).toBeInTheDocument();
    expect(screen.getByText("Codex CLI")).toBeInTheDocument();
    expect(screen.getByText("/workspace/ballet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /stop/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh capabilities" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/runtimes/devices/${device.id}/refresh`, expect.objectContaining({ method: "POST", body: "{}" })));
    await user.click(screen.getByRole("button", { name: "Request restart" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/runtimes/devices/${device.id}/restart`, expect.objectContaining({ method: "POST", body: "{}" })));

    await user.type(screen.getByLabelText("Search computers"), "build");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("search=build"), expect.anything()));
  });

  it("creates an install and device-code pairing session", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/runtimes/devices") return Response.json({ devices: [] });
      if (url === "/api/pairing/sessions" && init?.method === "POST") return Response.json({
        id: "pair-1",
        deviceCode: "device-secret",
        userCode: "ABCD-EFGH",
        status: "pending",
        expiresAt: "2026-07-11T10:10:00.000Z",
        installCommand: "ballet daemon install --code ABCD-EFGH"
      });
      return Response.json({ error: `Unhandled ${init?.method ?? "GET"} ${url}` }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<RuntimeRegistryView onSelectDevice={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Connect computer" }));
    await user.click(screen.getByRole("button", { name: "Create one-time code" }));
    expect(await screen.findByText("ballet daemon install --code ABCD-EFGH")).toBeInTheDocument();
    expect(screen.getByText("ABCD-EFGH")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve one-time code" })).toBeInTheDocument();
  });

  it("approves a claimed computer and exposes CLI readiness", async () => {
    const user = userEvent.setup();
    const readyDevice = runtimeDevice();
    const device = runtimeDevice({
      backends: [{
        ...readyDevice.backends[0],
        healthMessage: "Model discovery returned no available models.",
        capabilities: { ...readyDevice.backends[0].capabilities, models: [] }
      }]
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/runtimes/devices") return Response.json({ devices: [] });
      if (url === "/api/pairing/sessions" && init?.method === "POST") return Response.json({ id: "pair-2", deviceCode: "secret", userCode: "WXYZ-1234", status: "pending", expiresAt: "2026-07-11T10:10:00.000Z" });
      if (url === "/api/pairing/sessions/pair-2/approve" && init?.method === "POST") return Response.json({ id: "pair-2", deviceCode: "secret", userCode: "WXYZ-1234", status: "approved", expiresAt: "2026-07-11T10:10:00.000Z" });
      if (url === "/api/pairing/sessions/pair-2") return Response.json({ id: "pair-2", deviceCode: "secret", userCode: "WXYZ-1234", status: "claimed", expiresAt: "2026-07-11T10:10:00.000Z", deviceId: device.id, claimedDevice: device });
      return Response.json({ error: `Unhandled ${init?.method ?? "GET"} ${url}` }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<RuntimeRegistryView onSelectDevice={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Connect computer" }));
    await user.click(screen.getByRole("button", { name: "Create one-time code" }));
    await user.click(await screen.findByRole("button", { name: "Approve one-time code" }));
    expect(await screen.findByText(/Approved. Waiting for the daemon/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Check now" }));
    expect(await screen.findByRole("heading", { name: "Computer connected" })).toBeInTheDocument();
    expect(screen.getByText("No models")).toBeInTheDocument();
    expect(screen.getByText("Model discovery returned no available models.")).toBeInTheDocument();
  });

  it("opens a CLI-created pairing session from the verification URL", async () => {
    const pairingId = "10000000-0000-4000-8000-000000000099";
    window.history.replaceState({}, "", `/runtimes?pairing=${pairingId}`);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/runtimes/devices") return Response.json({ devices: [] });
      if (url === `/api/pairing/sessions/${pairingId}`) return Response.json({
        id: pairingId,
        deviceCode: "secret-device-code",
        userCode: "PAIR-2026",
        status: "pending",
        expiresAt: "2026-07-11T10:10:00.000Z",
        installCommand: "ballet setup --device-code secret-device-code"
      });
      return Response.json({ error: `Unhandled GET ${url}` }, { status: 404 });
    }));

    render(<RuntimeRegistryView onSelectDevice={vi.fn()} />);

    expect(await screen.findByText("PAIR-2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve one-time code" })).toBeInTheDocument();
  });
});
