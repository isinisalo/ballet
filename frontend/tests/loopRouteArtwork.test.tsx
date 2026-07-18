import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  defaultLoopTheme,
  defaultTerminalNodes,
  type ProjectLoop
} from "@shared/api/workspace-contracts";
import { AllLoopsCanvas } from "../src/workspace/automation/loops/AllLoopsCanvas";
import { LoopEditor } from "../src/workspace/automation/loops/LoopEditor";
import { LoopRouteArtwork } from "../src/workspace/automation/loops/LoopRouteArtwork";

const loop = (id: string): ProjectLoop => ({
  id,
  start: "gate",
  nodes: [{
    id: "gate",
    type: "human",
    nodeStyle: "flat",
    nodeSize: "tiny",
    description: "Gate",
    on: { approved: "completed", rejected: "blocked" }
  }, ...defaultTerminalNodes()]
});

describe("fixed Loop Route artwork", () => {
  it("renders self-contained token-based SVG artwork", () => {
    const { container } = render(<LoopRouteArtwork />);
    const artwork = container.querySelector("svg[data-loop-route-artwork]");

    expect(artwork).toHaveAttribute("aria-hidden", "true");
    expect(artwork).toHaveAttribute("focusable", "false");
    expect(artwork).toHaveAttribute("width", "24");
    expect(artwork).toHaveAttribute("height", "24");
    expect(container.querySelector("img, image")).not.toBeInTheDocument();
  });

  it("uses the fixed 24px Route artwork without a selector on All Loops cards", () => {
    const cardLoop = loop("delivery");
    const { container } = render(
      <AllLoopsCanvas
        config={{ version: 8, loops: [cardLoop] }}
        onAddLoop={() => undefined}
        onOpenLoop={() => undefined}
      />
    );

    expect(container.querySelector("svg[data-loop-route-artwork]")).toHaveAttribute("width", "24");
    expect(screen.queryByRole("combobox", { name: "Loop style" })).not.toBeInTheDocument();
  });

  it("uses the fixed 22px Route artwork for linked Loop nodes", async () => {
    const linked = loop("linked");
    const active = loop("active");
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
    expect(linkedNode.querySelector("svg[data-loop-route-artwork]")).toHaveAttribute("width", "22");
    expect(container.querySelector('[data-loop-summary="linked"]')).toBe(linkedNode);
  });

  it("keeps card deletion disabled for a locked Loop", () => {
    const cardLoop = loop("locked");
    render(
      <AllLoopsCanvas
        config={{ version: 8, loops: [cardLoop] }}
        onAddLoop={() => undefined}
        onOpenLoop={() => undefined}
        onDeleteLoop={() => undefined}
        lockedLoopIds={new Set([cardLoop.id])}
      />
    );

    expect(screen.getByRole("button", { name: "Delete loop" })).toBeDisabled();
  });

  it("confirms deletion from the All Loops card", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <AllLoopsCanvas
        config={{ version: 8, loops: [loop("delete-me")] }}
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
