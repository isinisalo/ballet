export { defaultProjectAutomationConfig } from "../shared/domain/automation.js";
export { normalizeProjectAutomationConfig } from "./automation/normalizeAutomationConfig.js";
export { AutomationValidationError, validateProjectAutomationConfig } from "./automation/validateAutomationConfig.js";
export {
  loadProjectAutomationConfig,
  loadProjectAutomationConfigWithIssues,
  saveProjectAutomationConfig
} from "./automation/automationRepository.js";
export {
  automationPoliciesToEventDefinitions,
  automationPoliciesToPolicies,
  automationRuntimesToRuntimes
} from "./automation/automationProjections.js";
export { mapAgentOutputToEvent } from "./automation/agentOutputEventMapper.js";
