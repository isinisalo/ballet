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
import type { z } from "zod";
import { projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import { defaultProjectConfiguration, type ProjectConfiguration } from "../../shared/domain/projectConfig.js";
import type { PortableAgentRuntimeIntent, RuntimeConfigurationIssue } from "../../shared/domain/runtime.js";

export interface ProjectConfigurationLoadResult {
  path: string;
  exists: boolean;
  source?: string;
  config?: ProjectConfiguration;
  issues: RuntimeConfigurationIssue[];
}

export class ProjectConfigurationSourceError extends Error {
  constructor(readonly issues: RuntimeConfigurationIssue[]) {
    super(".ballet/project.json is invalid and was left unchanged.");
    this.name = "ProjectConfigurationSourceError";
  }
}

export class ProjectConfigurationRepository {
  path(root: string): string {
    return path.join(root, ".ballet", "project.json");
  }

  load(root: string): ProjectConfigurationLoadResult {
    const filename = this.path(root);
    if (!existsSync(filename)) {
      return { path: filename, exists: false, config: defaultProjectConfiguration(), issues: [] };
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
        issues: [sourceIssue("invalid_json", ".ballet/project.json", error instanceof Error ? error.message : "Project config is not valid JSON.")]
      };
    }
    const parsed = projectConfigSchema.safeParse(value);
    if (!parsed.success) {
      return { path: filename, exists: true, source, issues: parsed.error.issues.map(toSourceIssue) };
    }
    return { path: filename, exists: true, source, config: normalize(parsed.data), issues: [] };
  }

  putAutomation(root: string, loops: ProjectConfiguration["loops"]): ProjectConfiguration {
    const loaded = this.load(root);
    assertWritable(loaded);
    const config = normalize({ ...loaded.config!, version: 8, loops });
    this.write(root, config);
    return config;
  }

  putAgentIntent(root: string, agentId: string, intent: PortableAgentRuntimeIntent): ProjectConfiguration {
    const loaded = this.load(root);
    assertWritable(loaded);
    const config = normalize({
      ...loaded.config!,
      version: 8,
      agents: { ...loaded.config!.agents, [agentId]: intent }
    });
    this.write(root, config);
    return config;
  }

  removeAgentIntent(root: string, agentId: string): ProjectConfiguration {
    const loaded = this.load(root);
    assertWritable(loaded);
    if (!Object.hasOwn(loaded.config!.agents, agentId)) return loaded.config!;
    const agents = { ...loaded.config!.agents };
    delete agents[agentId];
    const config = normalize({ ...loaded.config!, version: 8, agents });
    this.write(root, config);
    return config;
  }

  private write(root: string, config: ProjectConfiguration): void {
    const directory = path.join(root, ".ballet");
    const filename = this.path(root);
    mkdirSync(directory, { recursive: true });
    const temporary = path.join(directory, `.project.json.${process.pid}.${randomUUID()}.tmp`);
    let descriptor: number | undefined;
    try {
      descriptor = openSync(temporary, "wx", 0o666);
      writeFileSync(descriptor, `${JSON.stringify(normalize(config), null, 2)}\n`, "utf8");
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = undefined;
      renameSync(temporary, filename);
      const directoryDescriptor = openSync(directory, "r");
      try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
    } catch (error) {
      if (descriptor !== undefined) closeSync(descriptor);
      try { unlinkSync(temporary); } catch { /* Rename may already have completed. */ }
      throw error;
    }
  }
}

const normalize = (config: ProjectConfiguration): ProjectConfiguration => ({
  version: 8,
  agents: Object.fromEntries(Object.entries(config.agents)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([agentId, intent]) => [agentId, {
      provider: intent.provider,
      model: intent.model,
      reasoning: intent.reasoning,
      policy: { network: intent.policy.network }
    }])),
  loops: config.loops
});

const sourceIssue = (
  code: "invalid_json" | "invalid_schema",
  issuePath: string,
  message: string,
  agentId?: string
): RuntimeConfigurationIssue => ({ code, path: issuePath, message, agentId });

const toSourceIssue = (issue: z.core.$ZodIssue): RuntimeConfigurationIssue => sourceIssue(
  "invalid_schema",
  issue.path.length > 0 ? issue.path.map(String).join(".") : ".ballet/project.json",
  issue.message,
  issue.path[0] === "agents" && typeof issue.path[1] === "string" ? issue.path[1] : undefined
);

function assertWritable(loaded: ProjectConfigurationLoadResult): asserts loaded is ProjectConfigurationLoadResult & { config: ProjectConfiguration } {
  if (!loaded.config || loaded.issues.length > 0) throw new ProjectConfigurationSourceError(loaded.issues);
}
