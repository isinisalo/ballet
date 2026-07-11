import {
  defaultProjectAutomationConfig,
  type ProjectAutomationConfig
} from "../../shared/domain/automation.js";
import { automationConfigSchema } from "../../shared/api/workspace-schemas.js";

// Automation v3 is deliberately strict. This helper only narrows already
// canonical data; it never aliases, renames, or repairs legacy fields.
export const normalizeProjectAutomationConfig = (
  value: unknown
): ProjectAutomationConfig => {
  const parsed = automationConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultProjectAutomationConfig();
};
