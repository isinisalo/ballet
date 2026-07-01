import type { RequestHandler } from "express";
import { validateProjectAutomationConfig } from "../../automation/validateAutomationConfig.js";
import { AutomationValidationError } from "../../automation.js";
import { workspaceService } from "../../services/workspaceService.js";
import { automationConfigSchema } from "../validation/automationSchemas.js";
import { parseBody } from "../validation/httpValidation.js";

export const getAutomation: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await workspaceService.readAutomation());
  } catch (error) {
    next(error);
  }
};

export const saveAutomation: RequestHandler = async (req, res, next) => {
  try {
    const config = parseBody(automationConfigSchema, req);
    const data = await workspaceService.readData();
    const issues = validateProjectAutomationConfig(config, data.agents);
    if (issues.length > 0) {
      throw new AutomationValidationError("Automation config is invalid.", issues);
    }
    res.json(await workspaceService.saveAutomation(config));
  } catch (error) {
    next(error);
  }
};
