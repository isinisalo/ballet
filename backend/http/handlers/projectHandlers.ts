import type { RequestHandler } from "express";
import { readProjectConfigStatus } from "../../project/configGitStatus.js";
import { store } from "../../store.js";

export const configStatus: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await readProjectConfigStatus(store.root));
  } catch (error) {
    next(error);
  }
};
