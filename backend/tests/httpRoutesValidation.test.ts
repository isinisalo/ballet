import express from "express";
import { createServer, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import { apiRouter } from "../routes.js";

const listen = async (app: express.Express): Promise<{ server: Server; url: string }> => {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port.");
  return { server, url: `http://127.0.0.1:${address.port}` };
};

const postJson = (url: string, body: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

describe("API route validation", () => {
  it("returns schema validation issues for invalid API request bodies", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const { server, url } = await listen(app);

    try {
      const invalidDocument = await postJson(`${url}/api/project-documents`, {
        relativePath: ".ballet/project.md",
        frontmatter: {},
        body: "Body",
        extra: true
      });
      expect(invalidDocument.status).toBe(400);
      expect(await invalidDocument.json()).toMatchObject({
        error: "Request validation failed.",
        issues: expect.arrayContaining([expect.objectContaining({ path: "$" })])
      });

      const invalidEvent = await postJson(`${url}/api/events/intake`, {
        projectId: "project",
        eventType: "trigger.manual-start",
        correlationDepth: -1
      });
      expect(invalidEvent.status).toBe(400);
      expect(await invalidEvent.json()).toMatchObject({
        error: "Request validation failed.",
        issues: expect.arrayContaining([expect.objectContaining({ path: "correlationDepth" })])
      });

      const invalidAutomation = await fetch(`${url}/api/automation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: 1, triggers: [], policies: [], loops: [], runtimes: [], events: [] })
      });
      expect(invalidAutomation.status).toBe(400);
      expect(await invalidAutomation.json()).toMatchObject({
        error: "Request validation failed.",
        issues: expect.arrayContaining([expect.objectContaining({ path: "$" })])
      });

      const invalidAgent = await postJson(`${url}/api/agents`, { name: "Developer", unknown: true });
      expect(invalidAgent.status).toBe(400);
      expect(await invalidAgent.json()).toMatchObject({
        issues: expect.arrayContaining([expect.objectContaining({ path: "$" })])
      });

      const legacyPolicy = await postJson(`${url}/api/policies`, { id: "legacy" });
      expect(legacyPolicy.status).toBe(404);
      expect(await legacyPolicy.json()).toMatchObject({ error: "Unknown collection." });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
