import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { projectRuntimeConfigSchema } from "../../shared/api/runtime-schemas.js";
import type {
  PortableAgentRuntimeIntent,
  ProjectRuntimeConfig,
  RuntimeConfigurationIssue
} from "../../shared/domain/runtime.js";

export interface RuntimeIntentLoadResult {
  path: string;
  exists: boolean;
  source?: string;
  config?: ProjectRuntimeConfig;
  issues: RuntimeConfigurationIssue[];
}

export class RuntimeIntentSourceError extends Error {
  constructor(readonly issues: RuntimeConfigurationIssue[]) {
    super(".ballet/runtime.json is invalid and was left unchanged.");
    this.name = "RuntimeIntentSourceError";
  }
}

export class RuntimeIntentRepository {
  path(root: string): string {
    return path.join(root, ".ballet", "runtime.json");
  }

  load(root: string): RuntimeIntentLoadResult {
    const filename = this.path(root);
    if (!existsSync(filename)) {
      return { path: filename, exists: false, config: emptyConfig(), issues: [] };
    }

    const source = readFileSync(filename, "utf8");
    let value: unknown;
    try {
      value = JSON.parse(source) as unknown;
    } catch (error) {
      return {
        path: filename,
        exists: true,
        source,
        issues: [{
          code: "invalid_json",
          path: ".ballet/runtime.json",
          message: error instanceof Error ? error.message : "Runtime config is not valid JSON."
        }]
      };
    }

    const parsed = projectRuntimeConfigSchema.safeParse(value);
    if (!parsed.success) {
      return {
        path: filename,
        exists: true,
        source,
        issues: parsed.error.issues.map((issue) => ({
          code: "invalid_schema",
          path: issue.path.length > 0 ? issue.path.map(String).join(".") : ".ballet/runtime.json",
          message: issue.message,
          agentId: issue.path[0] === "agents" && typeof issue.path[1] === "string" ? issue.path[1] : undefined
        }))
      };
    }

    return { path: filename, exists: true, source, config: normalized(parsed.data), issues: [] };
  }

  put(root: string, agentId: string, intent: PortableAgentRuntimeIntent): ProjectRuntimeConfig {
    const loaded = this.load(root);
    assertWritable(loaded);
    const config = normalized({
      version: 1,
      agents: { ...loaded.config!.agents, [agentId]: intent }
    });
    this.write(root, config);
    return config;
  }

  remove(root: string, agentId: string): ProjectRuntimeConfig {
    const loaded = this.load(root);
    assertWritable(loaded);
    if (!Object.hasOwn(loaded.config!.agents, agentId)) return loaded.config!;
    const agents = { ...loaded.config!.agents };
    delete agents[agentId];
    const config = normalized({ version: 1, agents });
    this.write(root, config);
    return config;
  }

  private write(root: string, config: ProjectRuntimeConfig): void {
    const directory = path.join(root, ".ballet");
    const filename = this.path(root);
    mkdirSync(directory, { recursive: true });
    const temporary = path.join(directory, `.runtime.json.${process.pid}.${randomUUID()}.tmp`);
    let fileDescriptor: number | undefined;
    try {
      fileDescriptor = openSync(temporary, "wx", 0o666);
      writeFileSync(fileDescriptor, `${JSON.stringify(normalized(config), null, 2)}\n`, "utf8");
      fsyncSync(fileDescriptor);
      closeSync(fileDescriptor);
      fileDescriptor = undefined;
      renameSync(temporary, filename);
      const directoryDescriptor = openSync(directory, "r");
      try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
    } catch (error) {
      if (fileDescriptor !== undefined) closeSync(fileDescriptor);
      try { unlinkSync(temporary); } catch { /* The rename may already have completed. */ }
      throw error;
    }
  }
}

const emptyConfig = (): ProjectRuntimeConfig => ({ version: 1, agents: {} });

const normalized = (config: ProjectRuntimeConfig): ProjectRuntimeConfig => ({
  version: 1,
  agents: Object.fromEntries(Object.entries(config.agents)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([agentId, intent]) => [agentId, {
      provider: intent.provider,
      model: intent.model,
      reasoning: intent.reasoning,
      policy: { network: intent.policy.network }
    }]))
});

const assertWritable = (loaded: RuntimeIntentLoadResult): void => {
  if (!loaded.config || loaded.issues.length > 0) throw new RuntimeIntentSourceError(loaded.issues);
};
