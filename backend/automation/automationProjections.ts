import type { ProjectRuntime, Runtime } from "../../shared/domain/runtime.js";

const timestamp = "1970-01-01T00:00:00.000Z";

export const automationRuntimesToRuntimes = (runtimes: ProjectRuntime[]): Runtime[] =>
  runtimes.map((runtime) => ({
    id: runtime.id,
    name: runtime.title,
    type: runtime.command === "codex" ? "codex-cli" : "custom",
    command: [runtime.command, ...runtime.args].join(" ").trim(),
    config: { args: JSON.stringify(runtime.args) },
    enabled: true,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
