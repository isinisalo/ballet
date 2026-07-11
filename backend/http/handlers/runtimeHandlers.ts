import type { RequestHandler } from "express";
import { onRuntimeChanged } from "../../runtime-events.js";
import { store } from "../../store.js";

export const runtimeHealth: RequestHandler = (_req, res, next) => {
  try {
    res.json(store.runtimeHealth());
  } catch (error) {
    next(error);
  }
};

export const runtimeStream: RequestHandler = (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });

  const send = (type: string, payload: Record<string, unknown>) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send("ready", { ok: true, at: new Date().toISOString() });
  const unsubscribe = onRuntimeChanged((signal) => send("change", { signal, at: new Date().toISOString() }));
  const heartbeat = setInterval(() => send("heartbeat", { at: new Date().toISOString() }), 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
};
