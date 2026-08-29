const documentRoutes = (collection: string) => [
  `GET /api/${collection}`, `POST /api/${collection}`,
  `GET /api/${collection}/:id`, `PUT /api/${collection}/:id`,
  `DELETE /api/${collection}/:id`
] as const;

export const OrchestrationRouteInventory = [
  "GET /api/project", "PUT /api/project", "GET /api/events",
  ...documentRoutes("goals"), ...documentRoutes("adrs"), ...documentRoutes("constraints"),
  ...documentRoutes("use-cases"), ...documentRoutes("instructions"), ...documentRoutes("skills"),
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
  "GET /api/environment-runs/:runId/events", "GET /api/environment-runs/:runId/product",
  "GET /api/feedback", "POST /api/feedback", "GET /api/feedback/:id",
  "POST /api/feedback/:id/decision",
  "GET /api/critic/schedules", "GET /api/critic/runs", "POST /api/critic/runs",
  "GET /api/critic/proposals", "GET /api/critic/proposals/:id",
  "POST /api/critic/reconcile", "POST /api/critic/proposals/:id/decision",
  "GET /api/refinement/runs", "POST /api/refinement/runs",
  "GET /api/refinement/proposals", "GET /api/refinement/proposals/:id",
  "POST /api/refinement/proposals/:id/decision", "POST /api/refinement/proposals/:id/apply",
  "GET /api/refinement/proposals/:id/apply", "GET /api/refinement/proposals/:id/continuation"
] as const;

export const RuntimeSchemaInventory = Object.freeze({
  projectConfig: 20, rootSnapshot: 13, taskEnvelope: 10, roleOutcome: 10,
  promptComposition: 11, executionSpec: 12, sqlite: 16,
  feedback: 1, critic: 1, refinement: 1
});

export const OrchestrationProhibitedRoutes = [
  "/api/states/:id/runs", "/api/actions/:id/runs",
  "/api/environment-runs/:id/source"
] as const;
