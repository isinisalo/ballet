import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { AdrWorkspace } from "../src/orchestration/adrs/AdrWorkspace";
import { routeFromPath } from "../src/workspace/routing";
import { serializeAdr } from "../../shared/orchestration/adr";

const record = { id: "adr-034", title: "Suoritus", decision: "Validation ohjaa.", scope: "Environment Run." };
const document = { kind: "adr" as const, id: record.id, content: serializeAdr(record), contentHash: "old" };
const base = () => ({ documents: [document], navigate: vi.fn(), onSave: vi.fn().mockResolvedValue(document), onDelete: vi.fn().mockResolvedValue(undefined) });
it("shows full cards in numeric order and creates through the URL", async () => {
  const props = base(); const second = { ...document, id: "adr-002", content: serializeAdr({ ...record, id: "adr-002" }) };
  render(<AdrWorkspace {...props} documents={[document, second]} route={routeFromPath("/project/adrs")} />);
  expect(screen.getAllByRole("article").map((item) => item.getAttribute("aria-label"))).toEqual(["ADR-002", "ADR-034"]);
  expect(screen.getAllByText("Validation ohjaa.")).toHaveLength(2);
  await userEvent.click(screen.getByRole("button", { name: "Luo ADR" }));
  expect(props.navigate).toHaveBeenCalledWith("/project/adrs?create=adr");
});
it("creates a Finnish three-line record and focuses its saved card", async () => {
  const props = base(); const view = render(<AdrWorkspace {...props} route={routeFromPath("/project/adrs?create=adr")} />);
  expect(screen.getByLabelText("Tunniste")).toHaveValue("adr-035");
  expect(screen.queryByLabelText("YAML Frontmatter")).not.toBeInTheDocument();
  for (const [label, value] of [["Otsikko", "Uusi"], ["Päätös", "Yksi\nlähde."], ["Soveltamisala", "Projekti."]]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  await userEvent.click(screen.getByRole("button", { name: "Tallenna ADR" }));
  await waitFor(() => expect(props.onSave).toHaveBeenCalledWith("adr-035", "[ADR-035: Uusi]\nDecision: Yksi lähde.\nScope: Projekti.\n", "absent", true));
  const saved = { ...document, id: "adr-035", content: "[ADR-035: Uusi]\nDecision: Yksi lähde.\nScope: Projekti.\n" };
  view.rerender(<AdrWorkspace {...props} documents={[document, saved]} route={routeFromPath("/project/adrs")} />);
  expect(screen.getByRole("article", { name: "ADR-035" })).toHaveFocus();
});
it("retains a dirty draft and its original hash across external changes", async () => {
  const props = base(); const route = routeFromPath("/project/adrs?id=adr-034");
  const view = render(<AdrWorkspace {...props} route={route} />);
  expect(screen.getByLabelText("Tunniste")).toHaveAttribute("readonly");
  fireEvent.change(screen.getByLabelText("Päätös"), { target: { value: "Oma muutos." } });
  view.rerender(<AdrWorkspace {...props} documents={[{ ...document, contentHash: "new" }]} route={route} />);
  expect(screen.getByRole("button", { name: "Tallenna ADR" })).toBeDisabled();
  expect(screen.getByLabelText("Päätös")).toHaveValue("Oma muutos.");
  vi.spyOn(window, "confirm").mockReturnValue(true);
  await userEvent.click(screen.getByRole("button", { name: "Lataa nykyinen tiedosto" }));
  expect(screen.getByLabelText("Päätös")).toHaveValue(record.decision);
});
it("preserves a failed save and reports reference-blocked deletion", async () => {
  const props = base(); props.onSave.mockRejectedValue(new Error("Ristiriita")); props.onDelete.mockRejectedValue(new Error("User Story viittaa ADR:ään"));
  render(<AdrWorkspace {...props} route={routeFromPath("/project/adrs?id=adr-034")} />);
  fireEvent.change(screen.getByLabelText("Päätös"), { target: { value: "Oma muutos." } });
  await userEvent.click(screen.getByRole("button", { name: "Tallenna ADR" }));
  await screen.findByText("Ristiriita"); expect(screen.getByLabelText("Päätös")).toHaveValue("Oma muutos.");
  await userEvent.click(screen.getByRole("button", { name: "Poista ADR" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("ADR-034");
  const buttons = screen.getAllByRole("button", { name: "Poista ADR" }); await userEvent.click(buttons[buttons.length - 1]);
  await screen.findByText("User Story viittaa ADR:ään");
  expect(props.onDelete).toHaveBeenCalledWith("adr-034", "old");
});
it.each(["?id=wrong", "?id=adr-034&create=adr", "?create=story", "?id=adr-034&id=adr-035"])("rejects ambiguous routes %s", (query) => expect(routeFromPath(`/project/adrs${query}`).workspaceView).toBe("invalid"));
it("keeps a dirty editor mounted if its file disappears", () => {
  const props = base(); const route = routeFromPath("/project/adrs?id=adr-034");
  const view = render(<AdrWorkspace {...props} route={route} />);
  fireEvent.change(screen.getByLabelText("Päätös"), { target: { value: "Säilytä tämä luonnos." } });
  view.rerender(<AdrWorkspace {...props} documents={[]} route={route} />);
  expect(screen.getByLabelText("Päätös")).toHaveValue("Säilytä tämä luonnos.");
  expect(screen.getByRole("button", { name: "Tallenna ADR" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("ADR-tiedosto puuttuu");
});
