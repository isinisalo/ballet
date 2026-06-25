export interface LoopDefinition {
  id: string;
  version: number;
  name: string;
  description: string;
  active: boolean;
  entryEventTypes: string[];
  terminalEventTypes: string[];
  routingPolicyIds: string[];
  emissionPolicyIds: string[];
  limits: {
    maxHops: number;
    maxRuns: number;
    maxIterationsPerStep: number;
    deadlineSeconds?: number;
  };
  onLimitExceeded?: {
    eventType?: string;
  };
  createdAt: string;
  updatedAt: string;
  frontmatter?: Record<string, unknown>;
  body?: string;
  relativePath?: string;
  slug?: string;
  errors?: string[];
}

export interface LoopInstance {
  loopInstanceId: string;
  loopDefinitionId: string;
  loopDefinitionVersion: number;
  correlationId: string;
  status: "running" | "completed" | "exhausted" | "failed";
  hopCount: number;
  runCount: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  terminalEventId?: string;
  failureReason?: string;
}

