import express from "express";
import { createServer, type Server } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectAutomationConfig } from "../../shared/domain/automation.js";
import { defaultLoopTheme, type LoopTheme } from "../../shared/domain/loopThemes.js";
import { apiRouter } from "../routes.js";
import { store } from "../store.js";

const roots: string[] = [];

const config = (theme = "default"): ProjectAutomationConfig => ({
  version: 6,
  loops: [automationLoop("approval", theme)]
});

const automationLoop = (id: string, theme = "default"): ProjectAutomationConfig["loops"][number] => ({
  id,
  theme,
  start: "gate",
  steps: [{
    id: "gate",
    type: "human",
    description: "Approve.",
    nodeSize: "small",
    on: { approved: { end: "completed" }, rejected: { end: "failed" } }
  }]
});

const theme = (id: string, label = id): LoopTheme => ({
  ...structuredClone(defaultLoopTheme),
  id,
  label
});

const createProject = async (automation = config()): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-theme-api-"));
  roots.push(root);
  process.env.BALLET_PROJECT_ROOT = root;
  process.env.BALLET_CONTROL_PLANE_DB_PATH = path.join(root, "runtime.sqlite");
  await mkdir(path.join(root, ".ballet"), { recursive: true });
  await writeFile(path.join(root, ".ballet", "project.md"), "---\nid: theme-api\nname: Theme API\n---\n", "utf8");
  await writeFile(path.join(root, ".ballet", "project.json"), JSON.stringify({ ...automation, agents: {} }, null, 2), "utf8");
  return root;
};

const listen = async (): Promise<{ server: Server; origin: string }> => {
  const app = express();
  app.use(express.json());
  app.use("/api", apiRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind.");
  return { server, origin: `http://127.0.0.1:${address.port}` };
};

const requestJson = (url: string, method: "POST" | "PUT", body: unknown) => fetch(url, {
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

afterEach(async () => {
  store.runtimeDatabase().close();
  delete process.env.BALLET_PROJECT_ROOT;
  delete process.env.BALLET_CONTROL_PLANE_DB_PATH;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("loop theme API", () => {
  it("updates a built-in override and enforces URL/body identity", async () => {
    const root = await createProject();
    const { server, origin } = await listen();
    try {
      const override = theme("default", "Project default");
      const response = await requestJson(`${origin}/api/loop-themes/default`, "PUT", override);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(override);
      expect(JSON.parse(await readFile(path.join(root, ".ballet/themes/default.json"), "utf8"))).toEqual(override);

      const mismatch = await requestJson(
        `${origin}/api/loop-themes/default`,
        "PUT",
        theme("open-ai", "Wrong id")
      );
      expect(mismatch.status).toBe(400);
      expect(await mismatch.json()).toMatchObject({
        issues: [expect.objectContaining({ path: "id" })]
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("creates a unique project theme and atomically assigns it to the source loop", async () => {
    const root = await createProject();
    const { server, origin } = await listen();
    try {
      const createdTheme = theme("operator-night", "Operator night");
      const response = await requestJson(`${origin}/api/loop-themes`, "POST", {
        theme: createdTheme,
        assignToLoopId: "approval"
      });
      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({
        theme: createdTheme,
        automation: { loops: [expect.objectContaining({ id: "approval", theme: "operator-night" })] }
      });
      expect(JSON.parse(await readFile(path.join(root, ".ballet/project.json"), "utf8"))).toMatchObject({
        loops: [expect.objectContaining({ id: "approval", theme: "operator-night" })]
      });

      const duplicate = await requestJson(`${origin}/api/loop-themes`, "POST", {
        theme: createdTheme,
        assignToLoopId: "approval"
      });
      expect(duplicate.status).toBe(409);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});

describe("loop theme API concurrency", () => {
  it("returns one conflict for concurrent creates with the same theme id", async () => {
    const root = await createProject();
    const { server, origin } = await listen();
    try {
      const responses = await Promise.all([
        requestJson(`${origin}/api/loop-themes`, "POST", {
          theme: theme("shared-theme", "First writer"),
          assignToLoopId: "approval"
        }),
        requestJson(`${origin}/api/loop-themes`, "POST", {
          theme: theme("shared-theme", "Second writer"),
          assignToLoopId: "approval"
        })
      ]);

      expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
      const createdResponse = responses.find(({ status }) => status === 201);
      if (!createdResponse) throw new Error("One create request must succeed.");
      const created = await createdResponse.json() as { theme: LoopTheme };
      expect(JSON.parse(await readFile(path.join(root, ".ballet/themes/shared-theme.json"), "utf8")))
        .toEqual(created.theme);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("preserves both loop assignments across concurrent creates with different ids", async () => {
    const root = await createProject({
      version: 6,
      loops: [automationLoop("first-loop"), automationLoop("second-loop")]
    });
    const { server, origin } = await listen();
    try {
      const responses = await Promise.all([
        requestJson(`${origin}/api/loop-themes`, "POST", {
          theme: theme("first-theme"),
          assignToLoopId: "first-loop"
        }),
        requestJson(`${origin}/api/loop-themes`, "POST", {
          theme: theme("second-theme"),
          assignToLoopId: "second-loop"
        })
      ]);

      expect(responses.map(({ status }) => status)).toEqual([201, 201]);
      expect(JSON.parse(await readFile(path.join(root, ".ballet/project.json"), "utf8"))).toMatchObject({
        loops: [
          expect.objectContaining({ id: "first-loop", theme: "first-theme" }),
          expect.objectContaining({ id: "second-loop", theme: "second-theme" })
        ]
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});

describe("loop theme API reference validation", () => {
  it("repairs two missing theme references one create-and-assign at a time", async () => {
    const root = await createProject({
      version: 6,
      loops: [
        automationLoop("first-loop", "missing-first"),
        automationLoop("second-loop", "missing-second")
      ]
    });
    const { server, origin } = await listen();
    try {
      const first = await requestJson(`${origin}/api/loop-themes`, "POST", {
        theme: theme("missing-first", "First restored theme"),
        assignToLoopId: "first-loop"
      });
      expect(first.status).toBe(201);
      expect(await first.json()).toMatchObject({
        automation: { loops: [
          expect.objectContaining({ id: "first-loop", theme: "missing-first" }),
          expect.objectContaining({ id: "second-loop", theme: "missing-second" })
        ] }
      });

      const halfway = await fetch(`${origin}/api/data`);
      expect(await halfway.json()).toMatchObject({
        loopThemeIssues: [expect.objectContaining({
          path: "loops.1.theme",
          themeId: "missing-second",
          loopId: "second-loop"
        })]
      });

      const second = await requestJson(`${origin}/api/loop-themes`, "POST", {
        theme: theme("missing-second", "Second restored theme"),
        assignToLoopId: "second-loop"
      });
      expect(second.status).toBe(201);
      expect(await second.json()).toMatchObject({
        automation: { loops: [
          expect.objectContaining({ id: "first-loop", theme: "missing-first" }),
          expect.objectContaining({ id: "second-loop", theme: "missing-second" })
        ] }
      });
      expect(JSON.parse(await readFile(path.join(root, ".ballet/project.json"), "utf8"))).toMatchObject({
        loops: [
          expect.objectContaining({ id: "first-loop", theme: "missing-first" }),
          expect.objectContaining({ id: "second-loop", theme: "missing-second" })
        ]
      });
      expect((await fetch(`${origin}/api/data`).then((response) => response.json()) as { loopThemeIssues: unknown[] })
        .loopThemeIssues).toEqual([]);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("preserves an automation config with an unknown theme and reports the exact reference", async () => {
    await createProject(config("missing-theme"));
    const { server, origin } = await listen();
    try {
      const response = await fetch(`${origin}/api/data`);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        automation: { loops: [expect.objectContaining({ id: "approval", theme: "missing-theme" })] },
        loopThemes: expect.arrayContaining([expect.objectContaining({ id: "default" })]),
        loopThemeIssues: [{
          path: "loops.0.theme",
          message: "Loop approval references unknown theme: missing-theme.",
          themeId: "missing-theme",
          loopId: "approval"
        }]
      });

      const save = await requestJson(`${origin}/api/automation`, "PUT", config("another-missing-theme"));
      expect(save.status).toBe(400);
      expect(await save.json()).toMatchObject({
        error: "Automation config references an unknown loop theme.",
        issues: [expect.objectContaining({ path: "loops.0.theme", themeId: "another-missing-theme" })]
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
