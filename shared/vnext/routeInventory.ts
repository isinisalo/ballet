const documentRoutes = (collection: string) => [
  `GET /api/vnext/${collection}`, `POST /api/vnext/${collection}`,
  `GET /api/vnext/${collection}/:id`, `PUT /api/vnext/${collection}/:id`,
  `DELETE /api/vnext/${collection}/:id`
] as const;

export const VNextRouteInventory = [
  "GET /api/vnext/project", "PUT /api/vnext/project", "GET /api/vnext/events",
  ...documentRoutes("goals"), ...documentRoutes("adrs"), ...documentRoutes("constraints"),
  ...documentRoutes("use-cases"), ...documentRoutes("instructions"), ...documentRoutes("skills"),
  "POST /api/vnext/use-cases/:id/approve", "POST /api/vnext/use-cases/:id/return-to-draft",
  "GET /api/vnext/reference-index", "GET /api/vnext/environment", "PUT /api/vnext/environment",
  "POST /api/vnext/environment/states", "GET /api/vnext/environment/states/:stateId",
  "PUT /api/vnext/environment/states/:stateId",
  "DELETE /api/vnext/environment/states/:stateId", "POST /api/vnext/environment/states/reorder",
  "POST /api/vnext/environment/states/:stateId/actions",
  "GET /api/vnext/environment/states/:stateId/actions/:actionId",
  "PUT /api/vnext/environment/states/:stateId/actions/:actionId",
  "DELETE /api/vnext/environment/states/:stateId/actions/:actionId",
  "POST /api/vnext/environment/states/:stateId/actions/reprioritize",
  "POST /api/vnext/environment-runs", "GET /api/vnext/environment-runs",
  "GET /api/vnext/environment-runs/:runId", "POST /api/vnext/environment-runs/:runId/cancel",
  "GET /api/vnext/environment-runs/:runId/events", "GET /api/vnext/environment-runs/:runId/product",
  "GET /api/vnext/feedback", "POST /api/vnext/feedback", "GET /api/vnext/feedback/:id",
  "POST /api/vnext/feedback/:id/decision",
  "GET /api/vnext/critic/schedules", "GET /api/vnext/critic/runs", "POST /api/vnext/critic/runs",
  "GET /api/vnext/critic/proposals", "GET /api/vnext/critic/proposals/:id",
  "POST /api/vnext/critic/reconcile", "POST /api/vnext/critic/proposals/:id/decision",
  "GET /api/vnext/refinement/runs", "POST /api/vnext/refinement/runs",
  "GET /api/vnext/refinement/proposals", "GET /api/vnext/refinement/proposals/:id",
  "POST /api/vnext/refinement/proposals/:id/decision", "POST /api/vnext/refinement/proposals/:id/apply",
  "GET /api/vnext/refinement/proposals/:id/apply", "GET /api/vnext/refinement/proposals/:id/continuation"
] as const;

export const VNextSchemaInventory = Object.freeze({
  projectConfig: 20, rootSnapshot: 13, taskEnvelope: 10, roleOutcome: 10,
  promptComposition: 11, executionSpec: 12, sqlite: 16,
  feedback: 1, critic: 1, refinement: 1
});

export const VNextProhibitedRoutes = [
  "/api/vnext/states/:id/runs", "/api/vnext/actions/:id/runs",
  "/api/vnext/environment-runs/:id/source", "/api/vnext/automation/graph"
] as const;
