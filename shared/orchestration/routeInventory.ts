const documentRoutes = (collection: string) => [
  `GET /api/${collection}`, `POST /api/${collection}`,
  `GET /api/${collection}/:id`, `PUT /api/${collection}/:id`,
  `DELETE /api/${collection}/:id`
] as const;

export const OrchestrationRouteInventory = [
  "GET /api/project", "PUT /api/project", "GET /api/events",
  "GET /api/overview", "PUT /api/overview", ...documentRoutes("adrs"), "GET /api/agents", "GET /api/agents/:id", "PUT /api/agents/:id",
  ...documentRoutes("instructions"), ...documentRoutes("skills"),
  ...documentRoutes("user-stories"),
  "GET /api/event-storming", "PUT /api/event-storming",
  "GET /api/event-storming/layout", "PUT /api/event-storming/layout", "GET /api/event-storming/context",
  "POST /api/user-stories/:id/approve", "POST /api/user-stories/:id/return-to-draft",
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

export const OrchestrationProhibitedRoutes = [
  "/api/states/:id/runs", "/api/actions/:id/runs",
  "/api/environment-runs/:id/source"
] as const;
