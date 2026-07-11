export { defaultProjectAutomationConfig } from "../shared/domain/automation.js";
export { normalizeProjectAutomationConfig } from "./automation/normalizeAutomationConfig.js";
export { AutomationValidationError, validateProjectAutomationConfig } from "./automation/validateAutomationConfig.js";
export {
  compactProjectAutomationConfigForSave,
  loadProjectAutomationConfig,
  loadProjectAutomationConfigWithIssues,
  saveProjectAutomationConfig
} from "./automation/automationRepository.js";
