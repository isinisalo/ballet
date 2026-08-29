import type { RequestHandler } from "express";
import type { ControlPlaneService } from "../ControlPlaneService.js";
import { executionEventsQuerySchema, executionTaskParamsSchema } from "../../../shared/api/runtime-schemas.js";
import { parseParams, parseQuery } from "./HttpSupport.js";

export const executionConsoleStream = (service: ControlPlaneService): RequestHandler => (req, res, next) => {
  try {
    const { taskId } = parseParams(executionTaskParamsSchema, req);
    let cursor = parseQuery(executionEventsQuerySchema, req).after;
    service.getTask(taskId);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    const send = (includeTask = true) => {
      let page = service.eventPage(taskId, cursor, 500);
      while (page.entries.length > 0) {
        for (const entry of page.entries) {
          res.write(`id: ${entry.id}\nevent: console\ndata: ${JSON.stringify(entry)}\n\n`);
          cursor = entry.id;
        }
        if (!page.hasMore) break;
        page = service.eventPage(taskId, cursor, 500);
      }
      if (includeTask) {
        const task = service.getTask(taskId);
        res.write(`event: task\ndata: ${JSON.stringify(task)}\n\n`);
      }
    };
    send();
    const unsubscribe = service.onChange((type, payload) => {
      if (payload.taskId === taskId) send(type !== "execution_event");
    });
    const heartbeat = setInterval(() => res.write(`event: heartbeat\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`), 15_000);
    req.on("close", () => { clearInterval(heartbeat); unsubscribe(); res.end(); });
  } catch (error) {
    next(error);
  }
};
