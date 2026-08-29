const documentRoutes = (collection: string) => [
  `GET /api/${collection}`, `POST /api/${collection}`,
  `GET /api/${collection}/:id`, `PUT /api/${collection}/:id`,
  `DELETE /api/${collection}/:id`
] as const;

export const OrchestrationRouteInventory = [
  "GET /api/project", "PUT /api/project", "GET /api/events",
  ...documentRoutes("goals"), ...documentRoutes("adrs"), ...documentRoutes("constraints"),
  ...documentRoutes("use-cases"), ...documentRoutes("agents"), ...documentRoutes("instructions"), ...documentRoutes("skills"),
  "POST /api/use-cases/:id/approve", "POST /api/use-cases/:id/return-to-draft",
  "GET /api/reference-index", "GET /api/environment", "PUT /api/environment",
  "POST /api/environment/states", "GET /api/environment/states/:stateId",
  "PUT /api/environment/states/:stateId",
  "DELETE /api/environment/states/:stateId", "POST /api/environment/states/reorder",
  "POST /api/environment/states/:stateId/actions",
  "GET /api/environment/states/:stateId/actions/:actionId",
  "PUT /api/environment/states/:stateId/actions/:actionId",
  "DELETE /api/environment/states/:stateId/actions/:actionId",
  "POST /api/environment/states/:stateId/actions/reprioritize",
  "POST /api/environment-runs", "GET /api/environment-runs",
  "GET /api/environment-runs/:runId", "POST /api/environment-runs/:runId/cancel",
  "POST /api/environment-runs/:runId/work-input",
  "GET /api/environment-runs/:runId/events", "GET /api/environment-runs/:runId/evidence",
  "GET /api/feedback", "POST /api/feedback", "GET /api/feedback/:id",
  "POST /api/feedback/:id/decision", "POST /api/feedback/:id/refinement",
  "GET /api/critic/schedules", "GET /api/critic/runs", "POST /api/critic/runs",
  "GET /api/critic/proposals", "GET /api/critic/proposals/:id",
  "POST /api/critic/reconcile", "POST /api/critic/proposals/:id/decision",
  "GET /api/refinement/runs",
  "GET /api/refinement/proposals", "GET /api/refinement/proposals/:id",
  "POST /api/refinement/proposals/:id/decision", "POST /api/refinement/proposals/:id/apply",
  "GET /api/refinement/proposals/:id/apply", "GET /api/refinement/proposals/:id/continuation"
] as const;

export const RuntimeSchemaInventory = Object.freeze({
  projectConfig: 21, rootSnapshot: 14, taskEnvelope: 11, roleOutcome: 11,
  promptComposition: 12, executionSpec: 13, sqlite: 17,
  feedback: 2, critic: 2, refinement: 2, agentDaemonBinding: 1, runEvidence: 1
});

export const OrchestrationProhibitedRoutes = [
  "/api/states/:id/runs", "/api/actions/:id/runs",
  "/api/environment-runs/:id/source"
] as const;
