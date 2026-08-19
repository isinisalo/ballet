import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
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
import type { ProjectAutomationConfig, ProjectExecutionComposition } from "../../shared/domain/automation.js";
import {
  defaultProjectConfiguration,
  type ExecutionProfile,
  type ProjectConfiguration,
  type ProjectConfigurationIssue
} from "../../shared/domain/projectConfig.js";
import { ExecutionProfileConflictError, ExecutionProfileNotFoundError } from "./ExecutionProfileErrors.js";

export interface ProjectConfigurationLoadResult {
  path: string;
  exists: boolean;
  source?: string;
  config?: ProjectConfiguration;
  issues: ProjectConfigurationIssue[];
}

export class ProjectConfigurationSourceError extends Error {
  constructor(readonly issues: ProjectConfigurationIssue[]) {
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
    const directoryIssue = projectDirectoryIssue(root);
    if (directoryIssue) return { path: filename, exists: true, issues: [directoryIssue] };
    const fileStatus = status(filename);
    if (!fileStatus) {
      return { path: filename, exists: false, config: defaultProjectConfiguration(), issues: [] };
    }
    if (!fileStatus.isFile() || fileStatus.isSymbolicLink()) {
      return invalidSourceResult(
        filename,
        "invalid_schema",
        ".ballet/project.json must be an ordinary JSON file and must not be a symbolic link."
      );
    }

    const sourceResult = readProjectSource(filename);
    if (typeof sourceResult !== "string") return sourceResult;
    const source = sourceResult;
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
    if (isRecord(value) && value.version === 10) return {
      path: filename,
      exists: true,
      source,
      issues: [sourceIssue(
        "invalid_schema",
        "version",
        "Project configuration version 10 is not supported; update the project to strict v11."
      )]
    };
    if (isRecord(value) && value.version !== 11) return {
      path: filename,
      exists: true,
      source,
      issues: [sourceIssue(
        "invalid_schema",
        "version",
        `Strict project config version 11 is required; version ${String(value.version)} is not supported.`
      )]
    };
    const parsed = projectConfigSchema.safeParse(value);
    if (!parsed.success) {
      return { path: filename, exists: true, source, issues: parsed.error.issues.map(toSourceIssue) };
    }
    return { path: filename, exists: true, source, config: normalize(parsed.data), issues: [] };
  }

  putAutomation(root: string, automation: ProjectAutomationConfig): ProjectConfiguration {
    const loaded = this.load(root);
    assertWritable(loaded);
    const config = normalize({
      ...loaded.config,
      version: 11,
      orchestrator: automation.orchestrator,
      graph: automation.graph,
      loops: automation.loops
    });
    this.write(root, config);
    return config;
  }

  createExecutionProfile(root: string, profile: ExecutionProfile): ProjectConfiguration {
    const loaded = this.load(root);
    assertWritable(loaded);
    if (loaded.config.executionProfiles.some((candidate) => candidate.id === profile.id)) {
      throw new ExecutionProfileConflictError(`Execution profile ${profile.id} already exists.`);
    }
    const config = normalize({
      ...loaded.config,
      version: 11,
      executionProfiles: [...loaded.config.executionProfiles, profile]
    });
    this.write(root, config);
    return config;
  }

  updateExecutionProfile(root: string, profile: ExecutionProfile): ProjectConfiguration {
    const loaded = this.load(root);
    assertWritable(loaded);
    if (!loaded.config.executionProfiles.some((candidate) => candidate.id === profile.id)) {
      throw new ExecutionProfileNotFoundError(`Execution profile ${profile.id} was not found.`);
    }
    const config = normalize({
      ...loaded.config,
      version: 11,
      executionProfiles: loaded.config.executionProfiles.map((candidate) =>
        candidate.id === profile.id ? profile : candidate)
    });
    this.write(root, config);
    return config;
  }

  removeExecutionProfile(root: string, executionProfileId: string): ProjectConfiguration {
    const loaded = this.load(root);
    assertWritable(loaded);
    if (!loaded.config!.executionProfiles.some((profile) => profile.id === executionProfileId)) return loaded.config!;
    const config = normalize({
      ...loaded.config!,
      version: 11,
      executionProfiles: loaded.config!.executionProfiles.filter((profile) => profile.id !== executionProfileId)
    });
    this.write(root, config);
    return config;
  }

  private write(root: string, config: ProjectConfiguration): void {
    const normalized = normalize(config);
    const parsed = projectConfigSchema.safeParse(normalized);
    if (!parsed.success) throw new ProjectConfigurationSourceError(parsed.error.issues.map(toSourceIssue));
    const directory = path.join(root, ".ballet");
    const filename = this.path(root);
    ensureProjectDirectory(root);
    const temporary = path.join(directory, `.project.json.${process.pid}.${randomUUID()}.tmp`);
    let descriptor: number | undefined;
    try {
      descriptor = openSync(temporary, "wx", 0o666);
      writeFileSync(descriptor, `${JSON.stringify(parsed.data, null, 2)}\n`, "utf8");
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
  version: 11,
  executionProfiles: config.executionProfiles
    .map((profile) => ({
      id: profile.id,
      name: profile.name,
      provider: profile.provider,
      model: profile.model,
      reasoningEffort: profile.reasoningEffort,
      networkAccess: profile.networkAccess
    }))
    .sort((left, right) => compareIds(left.id, right.id)),
  orchestrator: normalizeComposition(config.orchestrator),
  graph: {
    loopEdges: config.graph.loopEdges.map((edge) => ({ ...edge }))
  },
  loops: config.loops.map((loop) => ({
    ...loop,
    capabilities: {
      accepts: [...loop.capabilities.accepts].sort(compareIds),
      provides: [...loop.capabilities.provides].sort(compareIds)
    },
    nodes: loop.nodes.map((node) => ({
      ...node,
      work: node.work.type === "human" ? node.work : normalizeComposition(node.work),
      validation: node.validation.type === "human" ? node.validation : normalizeComposition(node.validation)
    }))
  }))
});

const normalizeComposition = <T extends ProjectExecutionComposition>(composition: T): T => ({
  ...composition,
  skillIds: [...composition.skillIds].sort(compareIds)
});

const compareIds = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const sourceIssue = (
  code: "invalid_json" | "invalid_schema",
  issuePath: string,
  message: string
): ProjectConfigurationIssue => ({ code, path: issuePath, message });

const toSourceIssue = (issue: z.core.$ZodIssue): ProjectConfigurationIssue => sourceIssue(
  "invalid_schema",
  issue.path.length > 0 ? issue.path.map(String).join(".") : ".ballet/project.json",
  issue.message
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const status = (filename: string): ReturnType<typeof lstatSync> | undefined => {
  try {
    return lstatSync(filename);
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) return undefined;
    throw error;
  }
};

const projectDirectoryIssue = (root: string): ProjectConfigurationIssue | undefined => {
  const directoryStatus = status(path.join(root, ".ballet"));
  if (!directoryStatus || (directoryStatus.isDirectory() && !directoryStatus.isSymbolicLink())) return undefined;
  return sourceIssue(
    "invalid_schema",
    ".ballet",
    ".ballet must be an ordinary directory and must not be a symbolic link."
  );
};

const ensureProjectDirectory = (root: string): void => {
  const directory = path.join(root, ".ballet");
  if (!status(directory)) mkdirSync(directory);
  const issue = projectDirectoryIssue(root);
  if (issue) throw new ProjectConfigurationSourceError([issue]);
};

const readProjectSource = (filename: string): string | ProjectConfigurationLoadResult => {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
    if (!fstatSync(descriptor).isFile()) return invalidSourceResult(
      filename,
      "invalid_schema",
      ".ballet/project.json must be an ordinary JSON file."
    );
    const bytes = readFileSync(descriptor);
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return invalidSourceResult(
        filename,
        "invalid_json",
        ".ballet/project.json must contain valid UTF-8 JSON."
      );
    }
  } catch (error) {
    if (isFileSystemError(error, "ELOOP") || isFileSystemError(error, "EMLINK")) return invalidSourceResult(
      filename,
      "invalid_schema",
      ".ballet/project.json must be an ordinary JSON file and must not be a symbolic link."
    );
    throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
};

const invalidSourceResult = (
  filename: string,
  code: "invalid_json" | "invalid_schema",
  message: string
): ProjectConfigurationLoadResult => ({
  path: filename,
  exists: true,
  issues: [sourceIssue(code, ".ballet/project.json", message)]
});

const isFileSystemError = (error: unknown, code: string): boolean =>
  error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;

function assertWritable(loaded: ProjectConfigurationLoadResult): asserts loaded is ProjectConfigurationLoadResult & { config: ProjectConfiguration } {
  if (!loaded.config || loaded.issues.length > 0) throw new ProjectConfigurationSourceError(loaded.issues);
}
