import { useSyncExternalStore } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { StormCanvas } from "../src/orchestration/event-storming/StormCanvas";
import { StormDocumentStore } from "../src/orchestration/event-storming/StormDocumentStore";
import { useStormActions } from "../src/orchestration/event-storming/useStormActions";
import { emptyEventStormingModel, type EventStormingDocument } from "@shared/orchestration/eventStorming";
import { createBoard } from "../src/orchestration/event-storming/stormOperations";

test("canvas typing remains complete across renders and duplicate placements update together", async () => {
  const value = emptyEventStormingModel(), id = () => crypto.randomUUID();
  const noteId = id(); value.notes.push({ id: noteId, title: "", kind: "event", details: "", sources: [] });
  const board = createBoard(id(), "big-picture", "Workshop"); value.boards.push(board);
  for (let i = 0; i < 2; i++) board.placements.push({ id: id(), noteId, x: 200 + i * 240, y: 200, width: 184, height: 168, pivotal: false });
  const base: EventStormingDocument = { value, body: "", contentHash: "absent" };
  const save = vi.fn(async (value, _hash) => { void _hash; return { ...base, value, contentHash: "a".repeat(64) }; });
  const store = new StormDocumentStore({ read: async () => base, save }); await store.refresh();
  const { unmount } = render(<CanvasHarness store={store} />);
  const inputs = await screen.findAllByRole("textbox", { name: "Domain Event title" });
  await userEvent.type(inputs[0], "Order confirmed without losing letters");
  expect(inputs[0]).toHaveValue("Order confirmed without losing letters"); expect(inputs[1]).toHaveValue("Order confirmed without losing letters");
  await userEvent.keyboard("{Escape}"); expect(inputs[0]).not.toHaveFocus();
  await userEvent.keyboard("{F2}"); expect(inputs[0]).toHaveFocus();
  await act(() => store.save()); expect(save.mock.calls.at(-1)?.[0].notes[0].title).toBe("Order confirmed without losing letters");
  fireEvent.click(screen.getAllByRole("button", { name: "+ Details" })[0]);
  await userEvent.type(screen.getByRole("textbox", { name: "Source references" }), ".ballet/adr/adr-046.md");
  await act(() => store.save()); expect(store.getSnapshot().dirty).toBe(false);
  await act(async () => { store.undo(); });
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Source references" })).toHaveValue(".ballet/adr/adr-046.m"));
  unmount(); store.dispose();
});

function CanvasHarness({ store }: { store: StormDocumentStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const actions = useStormActions(state.value.boards[0], store.edit, vi.fn());
  return <div style={{ width: 1024, height: 768 }}><StormCanvas value={state.value} board={state.value.boards[0]} actions={actions} locked={false} undo={store.undo} redo={store.redo} /></div>;
}
