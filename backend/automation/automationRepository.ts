import { defaultProjectAutomationConfig, type ProjectAutomationConfig } from "../../shared/domain/automation.js";
import { AutomationValidationError, validateProjectAutomationConfig } from "./validateAutomationConfig.js";
import { ProjectConfigurationRepository } from "../project-config/ProjectConfigurationRepository.js";

const repository = new ProjectConfigurationRepository();

export const loadProjectAutomationConfigWithIssues = async (
  root: string
): Promise<{ config: ProjectAutomationConfig; issues: ReturnType<typeof validateProjectAutomationConfig> }> => {
  const loaded = repository.load(root);
  if (!loaded.exists) return { config: defaultProjectAutomationConfig(), issues: [] };
  if (!loaded.config) return {
    config: defaultProjectAutomationConfig(),
    issues: loaded.issues.map((issue) => ({ path: issue.path, message: issue.message }))
  };
  const value: ProjectAutomationConfig = {
    version: 16,
    graph: loaded.config.graph
  };
  const issues = validateProjectAutomationConfig(value, loaded.config.executionProfiles);
  return { config: value, issues };
};

export const loadProjectAutomationConfig = async (
  root: string
): Promise<ProjectAutomationConfig> => {
  const { config, issues } = await loadProjectAutomationConfigWithIssues(root);
  if (issues.length > 0) {
    throw new AutomationValidationError("Automation config is invalid.", issues);
  }
  return config;
};

export const saveProjectAutomationConfig = async (
  root: string,
  config: ProjectAutomationConfig
): Promise<ProjectAutomationConfig> => {
  const loaded = repository.load(root);
  if (!loaded.config) throw new AutomationValidationError(
    "Project config is invalid.",
    loaded.issues.map((issue) => ({ path: issue.path, message: issue.message }))
  );
  repository.putAutomation(root, config);
  return config;
};
