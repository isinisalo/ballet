import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { Agent } from "../../shared/domain/agents.js";
import { defaultProjectAutomationConfig, type ProjectAction, type ProjectAutomationConfig, type ProjectOutput } from "../../shared/domain/automation.js";
import { defaultProjectOutputs, isDefaultActionOutputIds } from "../../shared/policy-actions.js";
import { normalizeProjectAutomationConfig } from "./normalizeAutomationConfig.js";
import { AutomationValidationError, validateProjectAutomationConfig } from "./validateAutomationConfig.js";

const automationConfigPath = (root: string) => path.join(root, ".ballet", "project.json");

const parseAutomationJson = async (root: string): Promise<{ exists: boolean; value: unknown }> => {
  try {
    const source = await readFile(automationConfigPath(root), "utf8");
    return { exists: true, value: JSON.parse(source) as unknown };
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return { exists: false, value: defaultProjectAutomationConfig() };
    }
    throw error;
  }
};

type PersistedProjectAction = Omit<ProjectAction, "outputIds"> & {
  outputIds?: string[];
};

type PersistedProjectAutomationConfig = Omit<ProjectAutomationConfig, "actions" | "outputs"> & {
  actions: PersistedProjectAction[];
  outputs?: ProjectOutput[];
};

const isDefaultProjectOutputs = (outputs: ProjectOutput[]): boolean => {
  const defaults = defaultProjectOutputs();
  return outputs.length === defaults.length && outputs.every((output, index) => output.id === defaults[index]?.id);
};

export const compactProjectAutomationConfigForSave = (
  config: ProjectAutomationConfig
): PersistedProjectAutomationConfig => {
  const compactActions = config.actions.map((action) => {
    const compactAction: PersistedProjectAction = { ...action };
    if (isDefaultActionOutputIds(action.outputIds, action)) delete compactAction.outputIds;
    return compactAction;
  });
  return {
    version: config.version,
    actions: compactActions,
    ...(isDefaultProjectOutputs(config.outputs) ? {} : { outputs: config.outputs }),
    outputRoutes: config.outputRoutes,
    humanGateResponses: config.humanGateResponses,
    loops: config.loops,
    runtimes: config.runtimes
  };
};

export const loadProjectAutomationConfigWithIssues = async (
  root: string,
  agents: Agent[] = []
): Promise<{ config: ProjectAutomationConfig; issues: ReturnType<typeof validateProjectAutomationConfig> }> => {
  const { exists, value } = await parseAutomationJson(root);
  if (!exists) return { config: defaultProjectAutomationConfig(), issues: [] };
  const config = normalizeProjectAutomationConfig(value, agents);
  return {
    config,
    issues: validateProjectAutomationConfig(config, agents)
  };
};

export const loadProjectAutomationConfig = async (
  root: string,
  agents: Agent[] = []
): Promise<ProjectAutomationConfig> => {
  const { config, issues } = await loadProjectAutomationConfigWithIssues(root, agents);
  if (issues.length > 0) {
    throw new AutomationValidationError("Automation config is invalid.", issues);
  }
  return config;
};

export const saveProjectAutomationConfig = async (
  root: string,
  config: ProjectAutomationConfig,
  agents: Agent[] = []
): Promise<ProjectAutomationConfig> => {
  const issues = validateProjectAutomationConfig(config, agents);
  if (issues.length > 0) {
    throw new AutomationValidationError("Automation config is invalid.", issues);
  }

  const normalized = normalizeProjectAutomationConfig(config, agents);
  const normalizedIssues = validateProjectAutomationConfig(normalized, agents);
  if (normalizedIssues.length > 0) {
    throw new AutomationValidationError("Automation config is invalid.", normalizedIssues);
  }
  await mkdir(path.join(root, ".ballet"), { recursive: true });
  await writeFile(automationConfigPath(root), `${JSON.stringify(compactProjectAutomationConfigForSave(normalized), null, 2)}\n`, "utf8");
  return normalized;
};
