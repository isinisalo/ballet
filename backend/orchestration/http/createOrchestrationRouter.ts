import { registerEventStormingRoutes } from "./eventStormingRoutes.js";
import express from "express";
import type { TrustedHumanActor } from "../../../shared/orchestration/persistence.js";
import { HttpValidationError, parseBody, parseParams, parseUnknown } from "../../http/validation/httpValidation.js";
import type { ProjectDocumentKind } from "../project/ProjectReferenceIndex.js";
import type { ApiController } from "./ApiController.js";
import { registerUserStoryRoutes } from "./userStoryRoutes.js";
import {
  actionParamsSchema, createFeedbackSchema, criticDecisionSchema,
  directionDecisionSchema, emptySchema, eventQuerySchema, feedbackDecisionSchema, feedbackQuerySchema,
  createActionSchema, governanceAgentParamsSchema, idParamsSchema, putActionSchema, putAgentSchema, putDirectionSchema, putEnvironmentSchema, putProjectSchema,
  putResourceSchema, putStateSchema, refinementDecisionSchema, removeDirectionSchema,
  removeResourceSchema, reorderSchema, runParamsSchema, startRunSchema, stateParamsSchema,
  workInputResponseSchema,
  useCaseApprovalDecisionSchema
} from "../../../shared/orchestration/httpContracts.js";

export interface OrchestrationRouterOptions {
  controller: ApiController;
  actor(): TrustedHumanActor;
}

export const createOrchestrationRouter = ({ controller, actor }: OrchestrationRouterOptions): express.Router => {
  const router = express.Router();
  router.get("/project", route(async (_req, res) => res.json(controller.project())));
  router.put("/project", route(async (req, res) => {
    const input = parseBody(putProjectSchema, req); res.json(controller.putProject(input.config, input.expectedHash));
  }));
  registerDocumentRoutes(router, controller, actor);
  registerUserStoryRoutes(router, controller);
  registerEventStormingRoutes(router, controller);
  registerEnvironmentRoutes(router, controller);
  registerRunRoutes(router, controller, actor);
  registerFeedbackRoutes(router, controller, actor);
  registerReviewRoutes(router, controller, actor);
  router.get("/events", (req, res, next) => {
    try {
      const { after } = parseUnknown(eventQuerySchema, req.query); const events = controller.invalidationEvents(after);
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
      res.write("retry: 1000\n\n");
      for (const event of events) writeInvalidation(res, event);
      const unsubscribe = controller.subscribeInvalidations((event) => writeInvalidation(res, event));
      const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);
      req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
    } catch (error) { next(error); }
  });
  router.use((_req, res) => res.status(404).json({ error: "Unknown orchestration API route." }));
  return router;
};

const writeInvalidation = (response: express.Response, event: ReturnType<ApiController["invalidationEvents"]>[number]): void => {
  response.write(`id: ${event.sequence}\nevent: invalidation\ndata: ${JSON.stringify(event)}\n\n`);
};

const registerDocumentRoutes = (
  router: express.Router, controller: ApiController, actor: () => TrustedHumanActor
): void => {
  for (const [collection, kind] of [
    ["goals", "goal"], ["adrs", "adr"], ["constraints", "constraint"], ["use-cases", "use-case"]
  ] as const) {
    router.get(`/${collection}`, route(async (_req, res) => res.json(controller.documents(kind))));
    router.post(`/${collection}`, route(async (req, res) => {
      const input = parseBody(putDirectionSchema, req); const id = input.value.id;
      res.status(201).json(controller.createDirection({ kind, id, ...input }));
    }));
    router.get(`/${collection}/:id`, route(async (req, res) =>
      res.json(controller.document(kind, parseParams(idParamsSchema, req).id))));
    router.put(`/${collection}/:id`, route(async (req, res) => {
      const { id } = parseParams(idParamsSchema, req); const input = parseBody(putDirectionSchema, req);
      res.json(controller.updateDirection({ kind, id, ...input }));
    }));
    router.delete(`/${collection}/:id`, route(async (req, res) => {
      const { id } = parseParams(idParamsSchema, req); const input = parseBody(removeDirectionSchema, req);
      res.json(controller.removeDirection({ kind, id, expectedConfigHash: input.expectedConfigHash,
        expectedDocumentHash: input.expectedHash }));
    }));
  }
  router.get("/agents", route(async (_req, res) => res.json(controller.agents())));
  router.get("/agents/:id", route(async (req, res) => res.json(controller.agent(parseParams(governanceAgentParamsSchema, req).id))));
  router.put("/agents/:id", route(async (req, res) => {
    const { id } = parseParams(governanceAgentParamsSchema, req);
    res.json(controller.updateAgent({ id, ...parseBody(putAgentSchema, req) }));
  }));
  for (const [collection, kind] of [["instructions", "instruction"], ["skills", "skill"]] as const) {
    router.get(`/${collection}`, route(async (_req, res) => res.json(controller.documents(kind))));
    router.post(`/${collection}`, route(async (req, res) => {
      const input = parseBody(putResourceSchema.extend({ id: idParamsSchema.shape.id }), req);
      res.status(201).json(controller.createResource(kind, input.id, input.content, input.expectedHash));
    }));
    router.get(`/${collection}/:id`, route(async (req, res) =>
      res.json(controller.document(kind, parseParams(idParamsSchema, req).id))));
    router.put(`/${collection}/:id`, route(async (req, res) => {
      const input = parseBody(putResourceSchema, req); const { id } = parseParams(idParamsSchema, req);
      res.json(controller.updateResource(kind, id, input.content, input.expectedHash));
    }));
    router.delete(`/${collection}/:id`, route(async (req, res) => {
      const input = parseBody(removeResourceSchema, req); const { id } = parseParams(idParamsSchema, req);
      controller.removeResource(kind, id, input.expectedHash); res.status(204).end();
    }));
  }
  router.post("/use-cases/:id/approve", route(async (req, res) => {
    const { id } = parseParams(idParamsSchema, req); const input = parseBody(useCaseApprovalDecisionSchema, req);
    res.json(controller.approveUseCase(id, input.expectedConfigHash, input.expectedContentHash, actor()));
  }));
  router.post("/use-cases/:id/return-to-draft", route(async (req, res) => {
    const { id } = parseParams(idParamsSchema, req); const input = parseBody(directionDecisionSchema, req);
    res.json(controller.revokeUseCase(id, input.expectedConfigHash));
  }));
  router.get("/reference-index", route(async (_req, res) => res.json(controller.referenceIndex())));
};

const registerEnvironmentRoutes = (router: express.Router, controller: ApiController): void => {
  router.get("/environment", route(async (_req, res) => res.json(controller.environment())));
  router.put("/environment", route(async (req, res) => {
    const input = parseBody(putEnvironmentSchema, req); res.json(controller.putEnvironment(input.environment, input.expectedConfigHash));
  }));
  router.post("/environment/states/reorder", route(async (req, res) => {
    const input = parseBody(reorderSchema, req); res.json(controller.reorderStates(input.orderedIds, input.expectedConfigHash));
  }));
  router.post("/environment/states", route(async (req, res) => {
    const input = parseBody(putStateSchema, req); res.status(201).json(controller.createState(input.state, input.expectedConfigHash));
  }));
  router.get("/environment/states/:stateId", route(async (req, res) =>
    res.json(controller.state(parseParams(stateParamsSchema, req).stateId))));
  router.put("/environment/states/:stateId", route(async (req, res) => {
    const { stateId } = parseParams(stateParamsSchema, req); const input = parseBody(putStateSchema, req);
    if (stateId !== input.state.id) throw new HttpValidationError("State path id differs from body id.");
    res.json(controller.updateState(input.state, input.expectedConfigHash));
  }));
  router.delete("/environment/states/:stateId", route(async (req, res) => {
    const { stateId } = parseParams(stateParamsSchema, req); const input = parseBody(directionDecisionSchema, req);
    res.json(controller.removeState(stateId, input.expectedConfigHash));
  }));
  router.post("/environment/states/:stateId/actions/reprioritize", route(async (req, res) => {
    const { stateId } = parseParams(stateParamsSchema, req); const input = parseBody(reorderSchema, req);
    res.json(controller.reprioritizeActions(stateId, input.orderedIds, input.expectedConfigHash));
  }));
  router.post("/environment/states/:stateId/actions", route(async (req, res) => {
    const { stateId } = parseParams(stateParamsSchema, req); const input = parseBody(createActionSchema, req);
    res.status(201).json(controller.createAction(stateId, input.action, input.expectedConfigHash));
  }));
  router.get("/environment/states/:stateId/actions/:actionId", route(async (req, res) => {
    const { stateId, actionId } = parseParams(actionParamsSchema, req); res.json(controller.action(stateId, actionId));
  }));
  router.put("/environment/states/:stateId/actions/:actionId", route(async (req, res) => {
    const { stateId, actionId } = parseParams(actionParamsSchema, req); const input = parseBody(putActionSchema, req);
    if (actionId !== input.action.id) throw new HttpValidationError("Action path id differs from body id.");
    res.json(controller.updateAction(stateId, input.action, {
      validationAgent: input.validationAgent, workAgent: input.workAgent
    }, input.expectedConfigHash));
  }));
  router.delete("/environment/states/:stateId/actions/:actionId", route(async (req, res) => {
    const { stateId, actionId } = parseParams(actionParamsSchema, req); const input = parseBody(directionDecisionSchema, req);
    res.json(controller.removeAction(stateId, actionId, input.expectedConfigHash));
  }));
};

const registerRunRoutes = (
  router: express.Router, controller: ApiController, actor: () => TrustedHumanActor
): void => {
  router.post("/environment-runs", route(async (req, res) => {
    const input = parseBody(startRunSchema, req);
    res.status(201).json(await controller.startRun(input.environmentId, input.expectedConfigHash, input.input));
  }));
  router.get("/environment-runs", route(async (_req, res) => res.json(controller.listRuns())));
  router.get("/environment-runs/:runId", route(async (req, res) => res.json(controller.run(parseParams(runParamsSchema, req).runId))));
  router.post("/environment-runs/:runId/cancel", route(async (req, res) => {
    parseBody(emptySchema, req); res.json(await controller.cancelRun(parseParams(runParamsSchema, req).runId));
  }));
  router.post("/environment-runs/:runId/work-input", route(async (req, res) => {
    const input = parseBody(workInputResponseSchema, req);
    res.json(controller.answerWorkInput(parseParams(runParamsSchema, req).runId, input, actor()));
  }));
  router.get("/environment-runs/:runId/evidence", route(async (req, res) =>
    res.json(controller.evidence(parseParams(runParamsSchema, req).runId))));
  router.get("/environment-runs/:runId/events", (req, res, next) => {
    try {
      const { runId } = parseParams(runParamsSchema, req); const { after } = parseUnknown(eventQuerySchema, req.query);
      const facts = controller.eventFacts(runId, after);
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "close" });
      for (const fact of facts) res.write(`id: ${String(Reflect.get(fact as object, "sequence"))}\nevent: run-fact\ndata: ${JSON.stringify(fact)}\n\n`);
      res.end();
    } catch (error) { next(error); }
  });
};

const registerFeedbackRoutes = (
  router: express.Router, controller: ApiController, actor: () => TrustedHumanActor
): void => {
  router.get("/feedback", route(async (req, res) => res.json(controller.listFeedback(parseUnknown(feedbackQuerySchema, req.query)))));
  router.post("/feedback", route(async (req, res) => res.status(201).json(await controller.createFeedback(parseBody(createFeedbackSchema, req), actor()))));
  router.get("/feedback/:id", route(async (req, res) => res.json(controller.feedback(parseParams(idParamsSchema, req).id))));
  router.post("/feedback/:id/decision", route(async (req, res) => {
    const { id } = parseParams(idParamsSchema, req); const input = parseBody(feedbackDecisionSchema, req);
    controller.decideFeedback(id, input.from, input.decision, actor()); res.status(204).end();
  }));
  router.post("/feedback/:id/refinement", route(async (req, res) => {
    const { id } = parseParams(idParamsSchema, req); parseBody(emptySchema, req);
    res.status(201).json(await controller.createRefinementForFeedback(id));
  }));
};

const registerReviewRoutes = (
  router: express.Router, controller: ApiController, actor: () => TrustedHumanActor
): void => {
  router.get("/critic/schedules", route(async (_req, res) => res.json(controller.listCritic("schedules"))));
  router.get("/critic/runs", route(async (_req, res) => res.json(controller.listCritic("runs"))));
  router.get("/critic/proposals", route(async (_req, res) => res.json(controller.criticProposals())));
  router.get("/critic/proposals/:id", route(async (req, res) => res.json(controller.criticProposal(parseParams(idParamsSchema, req).id))));
  router.post("/critic/runs", route(async (req, res) => { parseBody(emptySchema, req); res.status(201).json(await controller.manualCritic()); }));
  router.post("/critic/reconcile", route(async (req, res) => { parseBody(emptySchema, req); res.json(await controller.reconcileCritic()); }));
  router.post("/critic/proposals/:id/decision", route(async (req, res) => {
    const { id } = parseParams(idParamsSchema, req); controller.decideCritic(id, parseBody(criticDecisionSchema, req), actor()); res.status(204).end();
  }));
  router.get("/refinement/runs", route(async (_req, res) => res.json(controller.listRefinement("runs"))));
  router.get("/refinement/proposals", route(async (_req, res) => res.json(controller.listRefinement("proposals"))));
  router.get("/refinement/proposals/:id", route(async (req, res) => res.json(await controller.refinementProposal(parseParams(idParamsSchema, req).id))));
  router.post("/refinement/proposals/:id/decision", route(async (req, res) => {
    const { id } = parseParams(idParamsSchema, req); await controller.decideRefinement(id, parseBody(refinementDecisionSchema, req), actor()); res.status(204).end();
  }));
  router.post("/refinement/proposals/:id/apply", route(async (req, res) => {
    const { id } = parseParams(idParamsSchema, req); parseBody(emptySchema, req); res.json(await controller.applyRefinement(id));
  }));
  router.get("/refinement/proposals/:id/apply", route(async (req, res) =>
    res.json(controller.refinementApplyStatus(parseParams(idParamsSchema, req).id))));
  router.get("/refinement/proposals/:id/continuation", route(async (req, res) =>
    res.json(controller.continuation(parseParams(idParamsSchema, req).id))));
};

const route = (handler: (req: express.Request, res: express.Response) => Promise<unknown>): express.RequestHandler =>
  (req, res, next) => { void handler(req, res).catch(next); };

export const orchestrationDocumentCollections: Readonly<Record<string, ProjectDocumentKind>> = Object.freeze({
  goals: "goal", adrs: "adr", constraints: "constraint", "use-cases": "use-case",
  "user-stories": "user-story",
  instructions: "instruction", skills: "skill"
});
