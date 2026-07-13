import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RuntimeLogsDialog } from "../src/workspace/runtimes/RuntimeLogsDialog";
import { runtimeRegistryApi } from "../src/workspace/runtimes/runtimeRegistryApi";

vi.mock("../src/workspace/runtimes/runtimeRegistryApi", () => ({
  runtimeRegistryApi: { logs: vi.fn() }
}));

describe("runtime logs dialog", () => {
  it("clears stale logs before a later load", async () => {
    const logs = vi.mocked(runtimeRegistryApi.logs);
    logs.mockResolvedValueOnce({ path: "/tmp/first.log", content: "old log content" });
    const { rerender } = render(<RuntimeLogsDialog open onOpenChange={vi.fn()} fallbackPath="/tmp/fallback.log" />);
    expect(await screen.findByText("old log content")).toBeInTheDocument();

    logs.mockRejectedValueOnce(new Error("read failed"));
    rerender(<RuntimeLogsDialog open={false} onOpenChange={vi.fn()} fallbackPath="/tmp/fallback.log" />);
    rerender(<RuntimeLogsDialog open onOpenChange={vi.fn()} fallbackPath="/tmp/fallback.log" />);

    expect(screen.queryByText("old log content")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("read failed")).toBeInTheDocument());
    expect(screen.queryByText("old log content")).not.toBeInTheDocument();
  });
});
