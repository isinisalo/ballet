import { createBalletServer } from "./server/createBalletServer.js";

const args = process.argv.slice(2);
const commandIndex = args.indexOf("server-internal-run");
const serverArgs = commandIndex >= 0 ? args.slice(commandIndex + 1) : args;
const options = parseServerOptions(serverArgs);
const ballet = await createBalletServer({ ...options, onShutdown: () => process.exit(0) });

ballet.server.listen(options.port, "127.0.0.1", () => {
  ballet.logger.info("Ballet is listening.", { port: options.port, root: ballet.context.root });
});

let signalShutdown = false;
const shutdown = () => {
  if (signalShutdown) return;
  signalShutdown = true;
  void ballet.shutdown().then(() => process.exit(0), (error) => {
    ballet.logger.error("Ballet shutdown failed.", error);
    process.exit(1);
  });
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

interface ServerOptions {
  root: string;
  stateRoot: string;
  port: number;
  codexCommand?: string;
  copilotCommand?: string;
  webDist?: string;
}

function parseServerOptions(args: string[]): ServerOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) throw new Error(`Invalid internal server argument: ${key ?? "<missing>"}`);
    values.set(key.slice(2), value);
  }
  for (const key of values.keys()) {
    if (!["root", "state-root", "port", "codex-command", "copilot-command", "web-dist"].includes(key)) {
      throw new Error(`Unknown internal server option --${key}.`);
    }
  }
  const root = values.get("root");
  const stateRoot = values.get("state-root");
  const port = Number(values.get("port"));
  if (!root || !stateRoot || !Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("server-internal-run requires --root, --state-root, and a valid --port.");
  }
  return {
    root, stateRoot, port,
    codexCommand: values.get("codex-command"),
    copilotCommand: values.get("copilot-command"),
    webDist: values.get("web-dist") ?? process.env.BALLET_WEB_DIST
  };
}
