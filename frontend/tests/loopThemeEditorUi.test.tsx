import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  defaultLoopTheme,
  defaultTerminalNodes,
  loopNodeStyles,
  type AppData,
  type LoopTheme,
  type ProjectLoop
} from "@shared/api/workspace-contracts";
import { WorkspaceApp } from "../src/WorkspaceApp";
import { emptyData } from "../src/workspace/types";
import { LoopThemeEditorView } from "../src/workspace/automation/themes/LoopThemeEditorView";
import { LoopThemePreview } from "../src/workspace/automation/themes/LoopThemePreview";
import { useLoopThemeEditor } from "../src/workspace/automation/themes/useLoopThemeEditor";
import { installThemeApi } from "./loopThemeEditorTestApi";

const loop: ProjectLoop = {
  id: "delivery",
  start: "approval",
  nodes: [{
    id: "approval",
    type: "human",
    nodeStyle: "sol",
    nodeSize: "large",
    description: "Approve delivery",
    on: { approved: "completed", rejected: "failed" }
  }, ...defaultTerminalNodes()]
};

const theme = () => structuredClone(defaultLoopTheme);
const data = (): AppData => ({
  ...emptyData,
  automation: { version: 8, loops: [structuredClone(loop)] },
  automationIssues: [],
  scheduleStates: [],
  loopTheme: theme(),
  loopThemeIssues: [],
  projectDocumentTree: []
});

function renderEditor(overrides: Partial<React.ComponentProps<typeof LoopThemeEditorView>> = {}) {
  const props: React.ComponentProps<typeof LoopThemeEditorView> = {
    data: data(),
    updateTheme: vi.fn(async (nextTheme: LoopTheme) => nextTheme),
    navigate: vi.fn(),
    setNavigationBlocker: vi.fn(),
    ...overrides
  };
  render(<LoopThemeEditorView {...props} />);
  return props;
}

function controlSection(name: string) {
  const section = screen.getByRole("heading", { name }).closest("section");
  if (!section) throw new Error(`${name} controls not found.`);
  return section;
}

describe("singleton Loop theme editor", () => {
  it("edits the only project theme without identity, usage, or renderer controls", () => {
    renderEditor();

    expect(screen.getByRole("form", { name: "Loop theme" })).toBeInTheDocument();
    expect(screen.getByText("Project-wide Loop visualization theme")).toBeInTheDocument();
    expect(screen.queryByLabelText("Theme ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /^(Tiny|Small|Medium|Large) style$/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ Loops?$/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("previews the complete grouped artwork catalog and a compact edge canvas", () => {
    render(<LoopThemePreview theme={theme()} />);
    const canvas = screen.getByLabelText("Theme preview loop canvas");
    const gallery = screen.getByLabelText("Node artwork catalog");

    expect(canvas).toHaveAttribute("data-loop-canvas-preview", "true");
    loopNodeStyles.forEach((style) => {
      const preview = gallery.querySelector(`[data-loop-artwork-preview='${style}']`);
      expect(preview).toBeInTheDocument();
      expect(preview?.querySelector(`[data-loop-node-style='${style}']`)).toBeInTheDocument();
    });
    expect(gallery.querySelector("[data-loop-route-preview] [data-loop-route-artwork]")).toBeInTheDocument();
    expect(gallery.querySelectorAll("[data-loop-artwork-gallery-group]")).toHaveLength(3);
    expect(gallery.querySelector("[data-loop-artwork-gallery-group='ship']")).not.toBeInTheDocument();
    expect(gallery.querySelector("[data-loop-artwork-gallery-group='monster']")).not.toBeInTheDocument();
    expect(canvas.querySelector("[data-loop-edge-style='solid']")).toBeInTheDocument();
    expect(canvas.querySelector("[data-loop-edge-output-slot-kind='rework']")).toHaveAttribute("data-loop-edge-style", "dotted");
    expect(canvas.querySelector("[data-loop-edge-tone='cross-loop']")).toHaveAttribute("data-loop-edge-style", "dashed");
    ["completed", "blocked", "failed"].forEach((status) => {
      expect(canvas.querySelector(`[data-loop-node-kind='terminal'] [data-loop-node-label='${status}']`)).toBeInTheDocument();
    });
    expect(within(canvas).queryByRole("button")).not.toBeInTheDocument();
    expect(within(gallery).queryByRole("button")).not.toBeInTheDocument();
    expect(gallery.querySelector("img")).not.toBeInTheDocument();
    expect([...canvas.querySelectorAll<HTMLElement>(".react-flow__node")].every((node) => node.style.pointerEvents === "none")).toBe(true);
    expect(canvas.querySelector("[data-loop-edge-animated='true']")).not.toBeInTheDocument();
  });

  it("applies color, avatar, edge, and connection controls to the live preview and save payload", async () => {
    const user = userEvent.setup();
    const props = renderEditor();
    const canvas = screen.getByLabelText("Theme preview loop canvas");
    const nodeSection = controlSection("Node");
    const edgeSection = controlSection("Edge");
    const connectionSection = controlSection("Connection point");

    await user.click(screen.getByRole("switch", { name: "Show agent avatars" }));
    await replaceValue(user, within(nodeSection).getByLabelText("Label font color"), "#111111");
    await replaceValue(user, within(nodeSection).getByLabelText("Glow color"), "#222222");
    await replaceValue(user, within(edgeSection).getByLabelText("Color"), "#123456");
    await replaceValue(user, within(edgeSection).getByLabelText("Label font color"), "#333333");
    await chooseOption(user, "Normal style", "dotted");
    await chooseOption(user, "Rejected style", "solid");
    await chooseOption(user, "Cross-Loop style", "dashed");
    await chooseOption(user, "Style", "Flow · attached");
    await replaceValue(user, within(connectionSection).getByLabelText("Color"), "#444444");

    expect(canvas.querySelector(".loop-agent-avatar")).toBeInTheDocument();
    expect(canvas.style.getPropertyValue("--loop-theme-node-label")).toBe("#111111");
    expect(canvas.style.getPropertyValue("--loop-theme-edge-color")).toBe("#123456");
    expect(canvas.style.getPropertyValue("--loop-theme-edge-label")).toBe("#333333");
    expect(canvas.style.getPropertyValue("--loop-theme-connection-point")).toBe("#444444");

    fireEvent.submit(screen.getByRole("form", { name: "Loop theme" }));
    await waitFor(() => expect(props.updateTheme).toHaveBeenCalledWith({
      version: 2,
      node: { labelColor: "#111111", glowColor: "#222222", showAgentAvatarInNode: true },
      edge: { color: "#123456", labelColor: "#333333", style: "dotted", rejectedStyle: "solid", crossLoopStyle: "dashed" },
      connectionPoint: { style: "flow", color: "#444444" }
    }));
  });

  it("keeps the last valid preview color and disables Save for an invalid hex value", async () => {
    const user = userEvent.setup();
    const props = renderEditor();
    const canvas = screen.getByLabelText("Theme preview loop canvas");
    const input = within(controlSection("Edge")).getByLabelText("Color");

    await replaceValue(user, input, "#123456");
    expect(canvas.style.getPropertyValue("--loop-theme-edge-color")).toBe("#123456");
    await replaceValue(user, input, "#123");

    expect(input).toHaveValue("#123");
    expect(canvas.style.getPropertyValue("--loop-theme-edge-color")).toBe("#123456");
    expect(screen.getByText("Use a six-digit hex color, for example #adc6ff.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(props.updateTheme).not.toHaveBeenCalled();
  });

  it("preserves a dirty draft when refreshed data arrives", () => {
    const initial = theme();
    const updateTheme = vi.fn(async (nextTheme: LoopTheme) => nextTheme);
    const { result, rerender } = renderHook(({ source }: { source: LoopTheme }) => useLoopThemeEditor({ source, updateTheme }), {
      initialProps: { source: initial }
    });

    act(() => result.current.setColor("edge.color", "#abcdef"));
    rerender({ source: { ...initial, edge: { ...initial.edge, labelColor: "#010101" } } });

    expect(result.current.draft.edge.color).toBe("#abcdef");
    expect(result.current.dirty).toBe(true);
  });

  it("surfaces theme file issues and enables an explicit repair save", async () => {
    const user = userEvent.setup();
    const workspace = data();
    workspace.loopThemeIssues = [{ path: ".ballet/theme.json.node.glowColor", message: "Invalid string" }];
    const updateTheme = vi.fn(async (nextTheme: LoopTheme) => nextTheme);

    renderEditor({ data: workspace, updateTheme });

    expect(screen.getByText(/Invalid string/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateTheme).toHaveBeenCalledWith(workspace.loopTheme));
  });

  it("persists through PUT /api/loop-theme on the singular route", async () => {
    const user = userEvent.setup();
    const workspace = data();
    const fetchMock = installThemeApi(workspace);
    window.history.replaceState({}, "", "/automation/theme");
    render(<WorkspaceApp />);

    expect(await screen.findByRole("form", { name: "Loop theme" })).toBeInTheDocument();
    const edgeColor = within(controlSection("Edge")).getByLabelText("Color");
    await replaceValue(user, edgeColor, "#123456");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/loop-theme",
      expect.objectContaining({ method: "PUT", body: expect.any(String) })
    ));
    const updateCall = fetchMock.mock.calls.find(([input, init]) => String(input) === "/api/loop-theme" && init?.method === "PUT");
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({ version: 2, edge: { color: "#123456" } });
    expect(`${window.location.pathname}${window.location.search}`).toBe("/automation/theme");
  });
});

async function chooseOption(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
}

async function replaceValue(user: ReturnType<typeof userEvent.setup>, input: HTMLElement, value: string) {
  await user.clear(input);
  await user.type(input, value);
}
