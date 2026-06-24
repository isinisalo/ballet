import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apiRouter } from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT ?? 4174);

app.use(express.json({ limit: "1mb" }));
app.use("/api", apiRouter);

const clientDistCandidates = [
  path.resolve(__dirname, "../dist"),
  path.resolve(process.cwd(), "dist")
];
const clientDist = clientDistCandidates.find((candidate) => existsSync(path.join(candidate, "index.html"))) ?? clientDistCandidates[0];
app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  void next;
  console.error(error);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`AgentOps MVP running at http://127.0.0.1:${port}`);
});
