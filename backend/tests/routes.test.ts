import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRouter } from "../routes.js";
import { store } from "../store.js";

const listen = async (app: express.Express): Promise<{ server: Server; url: string }> => {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port.");
  return { server, url: `http://127.0.0.1:${address.port}` };
};

describe("API routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves project Markdown documents without routing them through mutable collections", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);
    const saveProjectDocument = vi.spyOn(store, "saveProjectDocument").mockResolvedValue({
      id: "project",
      title: "Project",
      collection: "project",
      absolutePath: "/test/.ballet/project.md",
      relativePath: ".ballet/project.md",
      slug: "project",
      frontmatter: { title: "Project" },
      body: "Updated body"
    });
    const { server, url } = await listen(app);

    try {
      const response = await fetch(`${url}/api/project-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relativePath: ".ballet/project.md",
          frontmatter: { title: "Project" },
          body: "Updated body"
        })
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        relativePath: ".ballet/project.md",
        frontmatter: { title: "Project" }
      });
      expect(saveProjectDocument).toHaveBeenCalledWith({
        relativePath: ".ballet/project.md",
        frontmatter: { title: "Project" },
        body: "Updated body"
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
