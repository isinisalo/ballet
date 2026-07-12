import type { Agent } from "../../shared/domain/agents.js";
import { defaultProjectAutomationConfig, type ProjectAutomationConfig } from "../../shared/domain/automation.js";
import { AutomationValidationError, validateProjectAutomationConfig } from "./validateAutomationConfig.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";

const repository = new ProjectConfigurationRepository();

export const loadProjectAutomationConfigWithIssues = async (
  root: string,
  agents?: readonly Agent[]
): Promise<{ config: ProjectAutomationConfig; issues: ReturnType<typeof validateProjectAutomationConfig> }> => {
  const loaded = repository.load(root);
  if (!loaded.exists) return { config: defaultProjectAutomationConfig(), issues: [] };
  if (!loaded.config) return {
    config: defaultProjectAutomationConfig(),
    issues: loaded.issues.map((issue) => ({ path: issue.path, message: issue.message }))
  };
  const value = { version: 6 as const, loops: loaded.config.loops };
  const issues = validateProjectAutomationConfig(value, agents);
  return { config: value, issues };
};

export const loadProjectAutomationConfig = async (
  root: string,
  agents?: readonly Agent[]
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
  agents?: readonly Agent[]
): Promise<ProjectAutomationConfig> => {
  const issues = validateProjectAutomationConfig(config, agents);
  if (issues.length > 0) {
    throw new AutomationValidationError("Automation config is invalid.", issues);
  }

  repository.putAutomation(root, config.loops);
  return config;
};
