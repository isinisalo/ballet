export { defaultProjectAutomationConfig } from "../shared/domain/automation.js";
export {
  AutomationConflictError,
  AutomationValidationError,
  validateProjectExecutionResources,
  validateProjectAutomationConfig
} from "./automation/validateAutomationConfig.js";
export {
  loadProjectAutomationConfig,
  loadProjectAutomationConfigWithIssues,
  saveProjectAutomationConfig
} from "./automation/automationRepository.js";
