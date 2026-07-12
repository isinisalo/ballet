import { createBalletServer } from "./server/createBalletServer.js";

const port = Number(process.env.PORT ?? 4317);
const ballet = await createBalletServer();

ballet.server.listen(port, "127.0.0.1", () => {
  console.log(`Ballet running at http://127.0.0.1:${port} for ${ballet.project.id}`);
});

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await ballet.scheduler.stop();
  ballet.closeRunInvalidations();
  ballet.controlPlane.close();
  ballet.server.close(() => process.exit(0));
  // SSE requests are intentionally long-lived. Force them closed after the
  // WebSocket/control-plane teardown so launchd restarts cannot hang forever.
  ballet.server.closeAllConnections();
};

process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });
