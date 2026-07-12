import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  builtInLoopThemes,
  type AppData,
  type CreateLoopThemeResponse,
  type LoopTheme,
  type ProjectLoop
} from "@shared/api/workspace-contracts";
import { WorkspaceApp } from "../src/WorkspaceApp";
import { LoopThemeEditorView } from "../src/workspace/automation/themes/LoopThemeEditorView";
import { LoopThemePreview } from "../src/workspace/automation/themes/LoopThemePreview";
import { createLoopThemeDraft } from "../src/workspace/automation/themes/loopThemeEditorState";
import { useLoopThemeEditor } from "../src/workspace/automation/themes/useLoopThemeEditor";
import { installThemeApi } from "./loopThemeEditorTestApi";

const loop: ProjectLoop = {
  id: "delivery",
  theme: "open-ai",
  start: "approval",
  steps: [{
    id: "approval",
    type: "human",
    nodeSize: "large",
    description: "Approve delivery",
    on: { approved: { end: "completed" }, rejected: { end: "failed" } }
  }]
};

const themes = () => builtInLoopThemes.map((theme) => structuredClone(theme));
const openAiTheme = () => themes().find((theme) => theme.id === "open-ai")!;
const data = (): AppData => ({
  projects: [], goals: [], adrs: [], agents: [], skills: [], policies: [], eventDefinitions: [], events: [], loopRuns: [],
  automation: { version: 6, loops: [structuredClone(loop)] }, automationIssues: [], scheduleStates: [],
  loopThemes: themes(), loopThemeIssues: [], projectDocumentTree: []
});

const successfulCreate = async (theme: LoopTheme): Promise<CreateLoopThemeResponse> => ({
  theme,
  automation: { version: 6, loops: [{ ...structuredClone(loop), theme: theme.id }] }
});

function renderEditor(overrides: Partial<React.ComponentProps<typeof LoopThemeEditorView>> = {}) {
  const props: React.ComponentProps<typeof LoopThemeEditorView> = {
    data: data(),
    themeId: "open-ai",
    loopId: loop.id,
    updateTheme: vi.fn(async (theme: LoopTheme) => theme),
    createTheme: vi.fn(successfulCreate),
    navigate: vi.fn(),
    setNavigationBlocker: vi.fn(),
    ...overrides
  };
  render(<LoopThemeEditorView {...props} />);
  return props;
}

function edgeColorInput() {
  const section = screen.getByRole("heading", { name: "Edge" }).closest("section");
  if (!section) throw new Error("Edge controls not found.");
  return within(section).getByLabelText("Color");
}

describe("Loop Theme editor controls", () => {
  it("suggests valid kebab-case copy ids when a long source id is truncated", () => {
    const source = { ...openAiTheme(), id: `${"a".repeat(58)}-${"b".repeat(5)}` };
    const draft = createLoopThemeDraft(source, [source]);

    expect(draft.id).toBe(`${"a".repeat(58)}-copy`);
    expect(draft.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(draft.id.length).toBeLessThanOrEqual(64);
  });

  it("edits a theme with a live renderer and color preview, then saves it", async () => {
    const user = userEvent.setup();
    const props = renderEditor();
    const canvas = screen.getByLabelText("Theme preview loop canvas");
    const scheduledNode = screen.getByRole("img", { name: "Preview step scheduled-small" });

    expect(screen.getByLabelText("Theme ID")).toBeDisabled();
    expect(screen.getByText("1 Loop")).toBeInTheDocument();
    expect(scheduledNode).toHaveAttribute("data-loop-node-renderer", "luna");
    expect(canvas.style.getPropertyValue("--loop-theme-edge-color")).toBe("#76d4ca");

    await user.click(screen.getByRole("combobox", { name: "Small style" }));
    await user.click(await screen.findByRole("option", { name: "Flat" }));
    await user.clear(edgeColorInput());
    await user.type(edgeColorInput(), "#123456");

    expect(scheduledNode).toHaveAttribute("data-loop-node-renderer", "flat");
    expect(canvas.style.getPropertyValue("--loop-theme-edge-color")).toBe("#123456");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(props.updateTheme).toHaveBeenCalledWith(expect.objectContaining({
      id: "open-ai",
      node: expect.objectContaining({ styles: expect.objectContaining({ small: "flat" }) }),
      edge: expect.objectContaining({ color: "#123456" })
    })));
    expect(props.navigate).not.toHaveBeenCalled();
  });

  it("applies every renderer, avatar, edge, connection, and remaining color control to the preview", async () => {
    const user = userEvent.setup();
    const props = renderEditor();
    const canvas = screen.getByLabelText("Theme preview loop canvas");
    const nodeSection = screen.getByRole("heading", { name: "Node" }).closest("section")!;
    const edgeSection = screen.getByRole("heading", { name: "Edge" }).closest("section")!;
    const connectionSection = screen.getByRole("heading", { name: "Connection point" }).closest("section")!;

    await chooseOption(user, "Small style", "Terra");
    await chooseOption(user, "Medium style", "Sol");
    await chooseOption(user, "Large style", "Flat");
    await user.click(screen.getByRole("switch", { name: "Show agent avatars" }));
    await replaceValue(user, within(nodeSection).getByLabelText("Label font color"), "#111111");
    await replaceValue(user, within(nodeSection).getByLabelText("Glow color"), "#222222");
    await replaceValue(user, within(edgeSection).getByLabelText("Label font color"), "#333333");
    await chooseOption(user, "Normal style", "dotted");
    await chooseOption(user, "Rejected style", "solid");
    await chooseOption(user, "Cross-Loop style", "dashed");
    await chooseOption(user, "Style", "Flow · attached");
    await replaceValue(user, within(connectionSection).getByLabelText("Color"), "#444444");

    expect(screen.getByRole("img", { name: "Preview step scheduled-small" })).toHaveAttribute("data-loop-node-renderer", "terra");
    expect(screen.getByRole("img", { name: "Preview step agent-medium" })).toHaveAttribute("data-loop-node-renderer", "sol");
    expect(screen.getByRole("img", { name: "Preview step human-large" })).toHaveAttribute("data-loop-node-renderer", "flat");
    expect(canvas.querySelector(".loop-agent-avatar")).toBeInTheDocument();
    expect(canvas.style.getPropertyValue("--loop-theme-node-label")).toBe("#111111");
    expect(canvas.querySelector("[data-loop-node-kind='agent']")).toHaveStyle("--loop-node-glow-color: #222222");
    expect(canvas.style.getPropertyValue("--loop-theme-edge-label")).toBe("#333333");
    expect(canvas.style.getPropertyValue("--loop-theme-connection-point")).toBe("#444444");
    expect(canvas.querySelector("[data-loop-edge-label-value='triggered']")).toHaveAttribute("data-loop-edge-style", "dotted");
    expect(canvas.querySelector("[data-loop-edge-output-slot-kind='rework']")).toHaveAttribute("data-loop-edge-style", "solid");
    expect(canvas.querySelector("[data-loop-edge-tone='cross-loop']")).toHaveAttribute("data-loop-edge-style", "dashed");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(props.updateTheme).toHaveBeenCalledWith(expect.objectContaining({
      node: expect.objectContaining({
        labelColor: "#111111",
        glowColor: "#222222",
        styles: { small: "terra", medium: "sol", large: "flat" },
        showAgentAvatarInNode: true
      }),
      edge: expect.objectContaining({
        labelColor: "#333333",
        style: "dotted",
        rejectedStyle: "solid",
        crossLoopStyle: "dashed"
      }),
      connectionPoint: { style: "flow", color: "#444444" }
    })));
  });
});

describe("Loop Theme editor draft state", () => {
  it("keeps the last valid preview color and disables Save for an invalid hex value", async () => {
    const user = userEvent.setup();
    const props = renderEditor();
    const canvas = screen.getByLabelText("Theme preview loop canvas");
    const input = edgeColorInput();

    await user.clear(input);
    await user.type(input, "#123456");
    expect(canvas.style.getPropertyValue("--loop-theme-edge-color")).toBe("#123456");

    await user.clear(input);
    await user.type(input, "#123");

    expect(input).toHaveValue("#123");
    expect(canvas.style.getPropertyValue("--loop-theme-edge-color")).toBe("#123456");
    expect(screen.getByText("Use a six-digit hex color, for example #adc6ff.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(props.updateTheme).not.toHaveBeenCalled();
  });

  it("keeps invalid draft colors out of useLoopThemeEditor's preview and save path", async () => {
    const source = openAiTheme();
    const updateTheme = vi.fn(async (theme: LoopTheme) => theme);
    const { result } = renderHook(() => useLoopThemeEditor({
      source,
      themes: themes(),
      creating: false,
      assignToLoopId: loop.id,
      updateTheme,
      createTheme: vi.fn(successfulCreate)
    }));

    act(() => result.current.setColor("edge.color", "#abcdef"));
    expect(result.current.previewTheme.edge.color).toBe("#abcdef");
    act(() => result.current.setColor("edge.color", "#abc"));
    expect(result.current.draft.edge.color).toBe("#abc");
    expect(result.current.previewTheme.edge.color).toBe("#abcdef");
    expect(result.current.valid).toBe(false);

    await act(async () => { expect(await result.current.save()).toBeUndefined(); });
    expect(updateTheme).not.toHaveBeenCalled();
  });

  it("resets a dirty draft when navigation changes the editor identity", () => {
    const availableThemes = themes();
    const source = availableThemes.find((theme) => theme.id === "open-ai")!;
    const updateTheme = vi.fn(async (theme: LoopTheme) => theme);
    const createTheme = vi.fn(successfulCreate);
    const { result, rerender } = renderHook(({ creating }: { creating: boolean }) => useLoopThemeEditor({
      source,
      themes: availableThemes,
      creating,
      assignToLoopId: loop.id,
      updateTheme,
      createTheme
    }), { initialProps: { creating: false } });

    act(() => result.current.setColor("edge.color", "#abcdef"));
    expect(result.current.draft.edge.color).toBe("#abcdef");

    rerender({ creating: true });

    expect(result.current.draft.id).toBe("open-ai-copy");
    expect(result.current.draft.edge.color).toBe(source.edge.color);
    expect(result.current.dirty).toBe(true);
    expect(result.current.valid).toBe(true);
  });
});

describe("Loop Theme editor recovery and persistence", () => {
  it("repairs an invalid project theme from the visible default fallback", async () => {
    const user = userEvent.setup();
    const workspace = data();
    workspace.automation.loops[0]!.theme = "broken-theme";
    workspace.loopThemeIssues = [{
      path: ".ballet/themes/broken-theme.json.node.glowColor",
      message: "Invalid string",
      themeId: "broken-theme"
    }, {
      path: "loops.0.theme",
      message: "Loop delivery references unknown theme: broken-theme.",
      themeId: "broken-theme",
      loopId: "delivery"
    }];
    const updateTheme = vi.fn(async (theme: LoopTheme) => theme);

    renderEditor({ data: workspace, themeId: "broken-theme", updateTheme });

    expect(screen.getByLabelText("Theme ID")).toHaveValue("broken-theme");
    expect(screen.getByText(/Invalid string/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateTheme).toHaveBeenCalledWith(expect.objectContaining({
      id: "broken-theme",
      node: expect.objectContaining({ glowColor: "#adc6ff" })
    })));
  });

  it("creates a missing referenced theme from the visible default fallback", async () => {
    const user = userEvent.setup();
    const workspace = data();
    workspace.automation.loops[0]!.theme = "missing-theme";
    workspace.loopThemeIssues = [{
      path: "loops.0.theme",
      message: "Loop delivery references unknown theme: missing-theme.",
      themeId: "missing-theme",
      loopId: "delivery"
    }];
    const createTheme = vi.fn(successfulCreate);

    renderEditor({ data: workspace, themeId: "missing-theme", createTheme });

    expect(screen.getByLabelText("Theme ID")).toHaveValue("missing-theme");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createTheme).toHaveBeenCalledWith(
      expect.objectContaining({ id: "missing-theme" }),
      "delivery"
    ));
  });

  it("renders a fixed preview without interactive nodes, targets, pan, or animation", () => {
    render(<LoopThemePreview theme={openAiTheme()} />);
    const canvas = screen.getByLabelText("Theme preview loop canvas");
    const previewSteps = within(canvas).getAllByRole("img", { name: /^Preview step / });

    expect(canvas).toHaveAttribute("data-loop-canvas-preview", "true");
    expect(canvas).toHaveClass("cursor-default");
    expect(canvas.querySelector(".react-flow")).toHaveClass("mx-2", "w-[calc(100%-1rem)]");
    expect(previewSteps).toHaveLength(3);
    expect(within(canvas).getAllByRole("img", { name: /^Terminal target:/ }).length).toBeGreaterThan(0);
    expect(within(canvas).queryByRole("button")).not.toBeInTheDocument();
    expect(canvas.querySelector("[data-loop-output-event]")).toHaveAttribute("role", "img");
    expect([...canvas.querySelectorAll<HTMLElement>(".react-flow__node")].every((node) => node.style.pointerEvents === "none")).toBe(true);
    expect(canvas.querySelector("[data-loop-edge-animated='true']")).not.toBeInTheDocument();
  });

  it("creates and assigns a copied theme through the API, then replaces the route with edit mode", async () => {
    const user = userEvent.setup();
    const workspace = data();
    const fetchMock = installThemeApi(workspace);
    window.history.replaceState({}, "", "/automation/themes?newFrom=open-ai&loop=delivery");
    render(<WorkspaceApp />);

    expect(await screen.findByLabelText("Theme ID")).toHaveValue("open-ai-copy");
    expect(screen.getByLabelText("Theme ID")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Project Aurora");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/loop-themes",
      expect.objectContaining({ method: "POST", body: expect.any(String) })
    ));
    const createCall = fetchMock.mock.calls.find(([input, init]) => String(input) === "/api/loop-themes" && init?.method === "POST");
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      assignToLoopId: "delivery",
      theme: { id: "open-ai-copy", label: "Project Aurora" }
    });
    await waitFor(() => expect(`${window.location.pathname}${window.location.search}`)
      .toBe("/automation/themes?id=open-ai-copy&loop=delivery"));
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
