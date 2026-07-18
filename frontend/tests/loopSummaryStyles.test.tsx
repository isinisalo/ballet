import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  defaultLoopTheme,
  defaultTerminalNodes,
  loopSummaryStyles,
  type LoopRunDetails,
  type ProjectAutomationConfig,
  type ProjectLoop
} from "@shared/api/workspace-contracts";
import { AllLoopsCanvas } from "../src/workspace/automation/loops/AllLoopsCanvas";
import { LoopEditor } from "../src/workspace/automation/loops/LoopEditor";
import { createLoopDraft } from "../src/workspace/automation/loops/loopEditorState";
import { LoopSummaryArtwork } from "../src/workspace/automation/loops/LoopSummaryArtwork";
import { buildLoopVisualProjection, resolveLoopSummaryStyle } from "../src/workspace/automation/loops/loopVisualProjection";

const loop = (id: string, summaryStyle: ProjectLoop["summaryStyle"]): ProjectLoop => ({
  id,
  start: "gate",
  summaryStyle,
  nodes: [{
    id: "gate",
    type: "human",
    nodeStyle: "flat",
    nodeSize: "tiny",
    description: "Gate",
    on: { approved: "completed", rejected: "blocked" }
  }, ...defaultTerminalNodes()]
});

describe("Loop summary styles", () => {
  it("renders every style as self-contained token-based SVG artwork", () => {
    const { container } = render(<>{loopSummaryStyles.map((summaryStyle) => (
      <LoopSummaryArtwork key={summaryStyle} summaryStyle={summaryStyle} />
    ))}</>);

    const artworks = container.querySelectorAll("svg[data-loop-summary-style]");
    expect(artworks).toHaveLength(7);
    expect(container.querySelectorAll(".loop-summary-artwork__orbit")).toHaveLength(6);
    expect(container.querySelector("img, image")).not.toBeInTheDocument();
    artworks.forEach((artwork) => {
      expect(artwork).toHaveAttribute("aria-hidden", "true");
      expect(artwork).toHaveAttribute("focusable", "false");
      expect(artwork).toHaveAttribute("width", "24");
      expect(artwork).toHaveAttribute("height", "24");
    });
  });

  it("resolves active and linked Run snapshots before live styles", () => {
    const activeLive = loop("active", "spiral");
    const linkedLive = loop("linked", "ring");
    const activeSnapshot = loop("active", "edge-on");
    const config: ProjectAutomationConfig = { version: 8, loops: [activeLive, linkedLive] };
    const run = {
      loopId: "active",
      snapshot: activeSnapshot,
      loopSummarySnapshots: [
        { loopId: "active", summaryStyle: "barred-spiral" },
        { loopId: "linked", summaryStyle: "twin-core" }
      ],
      stepRuns: []
    } as unknown as LoopRunDetails;

    expect(buildLoopVisualProjection(config, activeSnapshot, run).config.loops).toEqual([
      expect.objectContaining({ id: "active", summaryStyle: "edge-on" }),
      expect.objectContaining({ id: "linked", summaryStyle: "twin-core" })
    ]);
    expect(buildLoopVisualProjection(config, { ...activeLive, summaryStyle: "irregular-nebula" }).config.loops[0])
      .toMatchObject({ summaryStyle: "irregular-nebula" });
    expect(resolveLoopSummaryStyle(config, activeSnapshot, "linked", { ...run, loopSummarySnapshots: undefined }))
      .toBe("ring");
    expect(resolveLoopSummaryStyle(config, activeSnapshot, "missing", { ...run, loopSummarySnapshots: undefined }))
      .toBe("route");
  });
});

describe("Loop summary style UI", () => {
  it("renders the labelled selector on an All Loops card and updates the selected Loop", async () => {
    const user = userEvent.setup();
    const draft = createLoopDraft();
    const onChange = vi.fn();
    render(
      <AllLoopsCanvas
        config={{ version: 8, loops: [draft] }}
        onAddLoop={() => undefined}
        onOpenLoop={() => undefined}
        onChangeLoop={onChange}
      />
    );

    expect(draft.summaryStyle).toBe("route");
    const selector = screen.getByRole("combobox", { name: "Loop style" });
    expect(selector).not.toHaveTextContent("Route");
    expect(selector.querySelector('svg[data-loop-summary-style="route"]')).toHaveAttribute("width", "24");

    await user.click(selector);
    await user.click(await screen.findByRole("option", { name: "Ring" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: draft.id, summaryStyle: "ring" }));
  });

  it("uses 24px summary artwork in All Loops cards", () => {
    const cardLoop = loop("galactic", "barred-spiral");
    const { container } = render(
      <AllLoopsCanvas config={{ version: 8, loops: [cardLoop] }} onAddLoop={() => undefined} onOpenLoop={() => undefined} />
    );

    expect(container.querySelector('svg[data-loop-summary-style="barred-spiral"]')).toHaveAttribute("width", "24");
  });

  it("threads a linked Loop style to the fixed 22px React Flow summary node", async () => {
    const linked = loop("linked", "twin-core");
    const active = loop("active", "spiral");
    const gate = active.nodes[0];
    if (!gate || gate.type !== "human") throw new Error("Expected a human gate fixture.");
    const activeWithLink = {
      ...active,
      nodes: [{ ...gate, on: { ...gate.on, approved: { loop: linked.id } } }, ...active.nodes.slice(1)]
    } satisfies ProjectLoop;
    const { container } = render(
      <LoopEditor
        config={{ version: 8, loops: [activeWithLink, linked] }}
        loop={activeWithLink}
        loops={[activeWithLink, linked]}
        agents={[]}
        theme={defaultLoopTheme}
        locked={false}
        onChange={() => undefined}
      />
    );

    const linkedNode = await screen.findByLabelText("Loop: linked");
    expect(linkedNode).toHaveClass("size-[22px]");
    expect(linkedNode.querySelector('svg[data-loop-summary-style="twin-core"]')).toHaveAttribute("width", "22");
    expect(container.querySelector('[data-loop-summary="linked"]')).toBe(linkedNode);
  });

  it("locks the Loop card controls while the Loop is locked or saving", () => {
    const draft = createLoopDraft();
    const view = render(
      <AllLoopsCanvas
        config={{ version: 8, loops: [draft] }}
        onAddLoop={() => undefined}
        onOpenLoop={() => undefined}
        onDeleteLoop={() => undefined}
        lockedLoopIds={new Set([draft.id])}
      />
    );
    expect(screen.getByRole("combobox", { name: "Loop style" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete loop" })).toBeDisabled();

    view.rerender(
      <AllLoopsCanvas
        config={{ version: 8, loops: [draft] }}
        onAddLoop={() => undefined}
        onOpenLoop={() => undefined}
        onDeleteLoop={() => undefined}
        disabled
      />
    );
    expect(screen.getByRole("combobox", { name: "Loop style" })).toBeDisabled();
  });

  it("saves a style change from the All Loops card", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<LoopSummarySaveHarness onSave={onSave} />);

    await user.click(screen.getByRole("combobox", { name: "Loop style" }));
    await user.click(await screen.findByRole("option", { name: "Edge-on" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ summaryStyle: "edge-on" }));
  });

  it("confirms deletion from the All Loops card", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const cardLoop = loop("delete-me", "route");
    render(
      <AllLoopsCanvas
        config={{ version: 8, loops: [cardLoop] }}
        onAddLoop={() => undefined}
        onOpenLoop={() => undefined}
        onDeleteLoop={onDelete}
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete loop" }));
    expect(screen.getByRole("dialog", { name: "Delete loop?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("delete-me");
  });
});

function LoopSummarySaveHarness({ onSave }: { onSave: (loop: ProjectLoop) => void }) {
  const initial = createLoopDraft();
  const [draft, setDraft] = useState(initial);
  return (
    <AllLoopsCanvas
      config={{ version: 8, loops: [draft] }}
      onAddLoop={() => undefined}
      onOpenLoop={() => undefined}
      onChangeLoop={(loop) => { setDraft(loop); onSave(loop); }}
    />
  );
}
