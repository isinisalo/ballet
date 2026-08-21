import { access, chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectIssueTrackerConfig } from "../../shared/domain/projectConfig.js";
import { TkTracker } from "./TkTracker.js";

const temporaryRoots: string[] = [];
const trackerConfig: ProjectIssueTrackerConfig = {
  kind: "tk",
  testedRevision: "d778bb520ee526c314c26f2bb876447e0a19caa5",
  orchestrationDirectory: ".tickets/orchestration",
  workDirectory: ".tickets/work"
};

afterEach(async () => Promise.all(
  temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
));

describe("TkTracker hermetic adapter", () => {
  it("passes the complete capability probe against strict JSONL and Markdown stores", async () => {
    const fixture = await fakeTk("ok");
    await expect(new TkTracker(fixture.command).preflight(fixture.worktree, trackerConfig)).resolves.toBeUndefined();
  });

  it("upserts by external-ref, reconciles parent and dependencies, and never invokes a shell", async () => {
    const fixture = await fakeTk("ok");
    const tracker = new TkTracker(fixture.command);
    const marker = path.join(fixture.root, "shell-was-invoked");
    const release = await tracker.upsert(fixture.worktree, trackerConfig, "work", {
      externalRef: "ballet-release:rel-001", title: "Release 001", type: "epic"
    });
    const prerequisite = await tracker.upsert(fixture.worktree, trackerConfig, "work", {
      externalRef: "ballet-work:prerequisite", title: "Prerequisite", type: "task", parentId: release.id
    });
    const input = {
      externalRef: "ballet-work:implementation",
      title: `Implement safely; $(touch ${marker})`,
      type: "feature" as const,
      parentId: release.id,
      dependencyIds: [prerequisite.id]
    };
    const first = await tracker.upsert(fixture.worktree, trackerConfig, "work", input);
    const second = await tracker.upsert(fixture.worktree, trackerConfig, "work", input);

    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({ parent: release.id, deps: [prerequisite.id] });
    expect(await tracker.query(fixture.worktree, trackerConfig, "work")).toHaveLength(3);
    await expect(access(marker)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("claims exactly one issue and prefers the selected release's in-progress issue", async () => {
    const fixture = await fakeTk("ok");
    const tracker = new TkTracker(fixture.command);
    const release = await tracker.upsert(fixture.worktree, trackerConfig, "work", {
      externalRef: "ballet-release:rel-002", title: "Release 002", type: "epic"
    });
    const inProgress = await tracker.upsert(fixture.worktree, trackerConfig, "work", {
      externalRef: "ballet-work:in-progress", title: "Existing work", type: "task",
      priority: 4, parentId: release.id
    });
    const higherPriority = await tracker.upsert(fixture.worktree, trackerConfig, "work", {
      externalRef: "ballet-work:open", title: "Open work", type: "task",
      priority: 0, parentId: release.id
    });
    await tracker.start(fixture.worktree, trackerConfig, "work", inProgress.id);

    const claimed = await tracker.claim(fixture.worktree, trackerConfig, { releaseTicketId: release.id });
    const tickets = await tracker.query(fixture.worktree, trackerConfig, "work");
    expect(claimed?.id).toBe(inProgress.id);
    expect(tickets.filter((ticket) => ticket.status === "in_progress").map(({ id }) => id)).toEqual([inProgress.id]);
    expect(tickets.find((ticket) => ticket.id === higherPriority.id)?.status).toBe("open");
  });

  it.each([
    ["malformed-jsonl", /malformed JSONL/],
    ["malformed-markdown", /Malformed tk Markdown ticket/],
    ["duplicate-external-ref", /Duplicate tk external-ref/],
    ["dangling-dependency", /dangling dependency/],
    ["dangling-parent", /dangling parent/],
    ["dependency-cycle", /dependency graph contains a cycle/],
    ["parent-cycle", /parent graph contains a cycle/]
  ] as const)("fails closed for %s", async (mode, expected) => {
    const fixture = await fakeTk(mode);
    await expect(new TkTracker(fixture.command).query(fixture.worktree, trackerConfig, "work"))
      .rejects.toThrow(expected);
  });

  it("bounds command time and rejects stores outside the Run worktree", async () => {
    const fixture = await fakeTk("timeout");
    await expect(new TkTracker(fixture.command, 25).query(fixture.worktree, trackerConfig, "work"))
      .rejects.toThrow(/timed out/);
    await expect(new TkTracker(fixture.command).query(fixture.worktree, {
      ...trackerConfig, workDirectory: "../outside"
    }, "work")).rejects.toThrow(/inside the Run worktree/);
  });
});

type FakeMode =
  | "ok" | "timeout" | "malformed-jsonl" | "malformed-markdown"
  | "duplicate-external-ref" | "dangling-dependency" | "dangling-parent"
  | "dependency-cycle" | "parent-cycle";

const fakeTk = async (mode: FakeMode) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-fake-tk-"));
  temporaryRoots.push(root);
  const worktree = path.join(root, "worktree");
  const command = path.join(root, "tk.mjs");
  await mkdir(worktree, { recursive: true });
  await writeFile(command, fakeTkSource(mode), "utf8");
  await chmod(command, 0o755);
  return { root, worktree, command };
};

const fakeTkSource = (mode: FakeMode): string => `#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const mode = ${JSON.stringify(mode)};
const argv = process.argv.slice(2);
if (argv[0] !== "--dir" || !argv[1] || !argv[2]) throw new Error("expected --dir <store> <command>");
const store = path.resolve(argv[1]);
const command = argv[2];
const args = argv.slice(3);
mkdirSync(store, { recursive: true });

if (mode === "timeout") await new Promise((resolve) => setTimeout(resolve, 10_000));
if (mode === "malformed-jsonl" && command === "query") {
  process.stdout.write("{not-json}\\n");
  process.exit(0);
}

const stateFile = path.join(store, ".fake-tk-state.json");
let tickets = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : [];
const ticket = (id, overrides = {}) => ({
  id, status: "open", deps: [], links: [], created: "2026-08-21T00:00:00Z",
  type: "task", priority: 2, ...overrides
});

if (tickets.length === 0 && command === "query") {
  if (mode === "malformed-markdown") tickets = [ticket("tk-1")];
  if (mode === "duplicate-external-ref") tickets = [
    ticket("tk-1", { "external-ref": "duplicate" }), ticket("tk-2", { "external-ref": "duplicate" })
  ];
  if (mode === "dangling-dependency") tickets = [ticket("tk-1", { deps: ["tk-missing"] })];
  if (mode === "dangling-parent") tickets = [ticket("tk-1", { parent: "tk-missing" })];
  if (mode === "dependency-cycle") tickets = [
    ticket("tk-1", { deps: ["tk-2"] }), ticket("tk-2", { deps: ["tk-1"] })
  ];
  if (mode === "parent-cycle") tickets = [
    ticket("tk-1", { parent: "tk-2" }), ticket("tk-2", { parent: "tk-1" })
  ];
}

const markdown = (value) => [
  "---",
  "id: " + JSON.stringify(value.id),
  "status: " + JSON.stringify(value.status),
  "deps: " + JSON.stringify(value.deps),
  "links: " + JSON.stringify(value.links),
  "created: " + JSON.stringify(value.created),
  "type: " + JSON.stringify(value.type),
  "priority: " + JSON.stringify(value.priority),
  ...(value.assignee ? ["assignee: " + JSON.stringify(value.assignee)] : []),
  ...(value["external-ref"] ? ["external-ref: " + JSON.stringify(value["external-ref"])] : []),
  ...(value.parent ? ["parent: " + JSON.stringify(value.parent)] : []),
  "---",
  "# Ticket " + value.id,
  "",
  "Hermetic fake ticket.",
  ""
].join("\\n");

const save = () => {
  writeFileSync(stateFile, JSON.stringify(tickets));
  for (const name of readdirSync(store)) if (name.endsWith(".md")) unlinkSync(path.join(store, name));
  for (const value of tickets) writeFileSync(path.join(store, value.id + ".md"), markdown(value));
  if (mode === "malformed-markdown" && tickets[0]) {
    writeFileSync(path.join(store, tickets[0].id + ".md"), "not a ticket\\n");
  }
};
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const requireTicket = (id) => {
  const value = tickets.find((candidate) => candidate.id === id);
  if (!value) throw new Error("missing ticket " + id);
  return value;
};

if (command === "new") {
  const id = "tk-" + (tickets.length + 1);
  tickets.push(ticket(id, {
    type: option("--type") || "task",
    priority: Number(option("--priority") || 2),
    ...(option("--external-ref") ? { "external-ref": option("--external-ref") } : {}),
    ...(option("--parent") ? { parent: option("--parent") } : {})
  }));
  save();
  process.stdout.write(id + "\\n");
} else if (command === "query") {
  save();
  for (const value of tickets) process.stdout.write(JSON.stringify(value) + "\\n");
} else if (command === "dep") {
  const value = requireTicket(args[0]);
  requireTicket(args[1]);
  if (!value.deps.includes(args[1])) value.deps.push(args[1]);
  save();
} else if (command === "start" || command === "close" || command === "reopen") {
  const value = requireTicket(args[0]);
  value.status = command === "start" ? "in_progress" : command === "close" ? "closed" : "open";
  save();
} else if (command === "note") {
  requireTicket(args[0]);
  save();
} else if (command === "ready") {
  save();
} else if (command === "show") {
  process.stdout.write(markdown(requireTicket(args[0])));
} else {
  throw new Error("unsupported fake tk command " + command);
}
`;
