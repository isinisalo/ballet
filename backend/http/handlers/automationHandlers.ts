import type { RequestHandler } from "express";
import { validateProjectAutomationConfig } from "../../automation/validateAutomationConfig.js";
import { AutomationValidationError } from "../../automation.js";
import { store } from "../../store.js";
import { automationConfigSchema } from "../validation/schemas.js";
import { parseBody } from "../validation/httpValidation.js";

export const getAutomation: RequestHandler = async (_req, res, next) => {
  try {
    const data = await store.read();
    res.json({ config: data.automation, issues: data.automationIssues });
  } catch (error) {
    next(error);
  }
};

export const saveAutomation: RequestHandler = async (req, res, next) => {
  try {
    const config = parseBody(automationConfigSchema, req);
    const data = await store.read();
    const issues = validateProjectAutomationConfig(config, data.agents);
    if (issues.length > 0) {
      throw new AutomationValidationError("Automation config is invalid.", issues);
    }
    res.json(await store.saveAutomation(config));
  } catch (error) {
    next(error);
  }
};
