import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { emptyBodySchema } from "../../shared/api/runtime-schemas.js";
import { sendKnownHttpError } from "../http/errors.js";
import { parseBody } from "../http/validation/httpValidation.js";
import { loopbackSecurity } from "../server/createBalletServer.js";

let server: Server | undefined;

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  server = undefined;
});

describe("HTTP boundary", () => {
  it("maps malformed and oversized JSON at the app error boundary", async () => {
    const baseUrl = await startTestApp();

    const malformed = await fetch(`${baseUrl}/api/test`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://127.0.0.1:4317" },
      body: "{"
    });
    const oversized = await fetch(`${baseUrl}/api/test`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://127.0.0.1:4317" },
      body: JSON.stringify({ padding: "x".repeat(100) })
    });

    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toEqual({ error: "Request body contains invalid JSON." });
    expect(oversized.status).toBe(413);
    await expect(oversized.json()).resolves.toEqual({ error: "Request body is too large." });
  });

  it("allows the proxy-rewritten backend origin and blocks a direct foreign origin", async () => {
    const baseUrl = await startTestApp();

    const allowed = await fetch(`${baseUrl}/api/test`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://127.0.0.1:4317" },
      body: "{}"
    });
    const blocked = await fetch(`${baseUrl}/api/test`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.test" },
      body: "{}"
    });

    expect(allowed.status).toBe(204);
    expect(blocked.status).toBe(403);
  });
});

const startTestApp = async (): Promise<string> => {
  const app = express();
  app.use(loopbackSecurity(4317));
  app.use(express.json({ limit: "32b" }));
  app.post("/api/test", (req, res, next) => {
    try {
      parseBody(emptyBodySchema, req);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next;
    if (!sendKnownHttpError(error, res)) res.status(500).json({ error: "Internal server error." });
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to TCP.");
  return `http://127.0.0.1:${address.port}`;
};
