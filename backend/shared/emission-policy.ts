import type { Condition } from "./conditions.js";
import type { MappingExpression } from "./mapping.js";
import type { VersionedRef } from "./json.js";

export type EmissionGate =
  | {
      type: "git_commit_exists";
      path: string;
    }
  | {
      type: "no_failed_checks";
      path: string;
      required?: boolean;
    }
  | {
      type: "required_value";
      path: string;
    };

export interface EmissionPolicy {
  id: string;
  version: number;
  name: string;
  description: string;
  active: boolean;
  observes: {
    operation: VersionedRef;
  };
  when?: Condition;
  gates?: EmissionGate[];
  emissions: Array<{
    slot: string;
    eventType: string;
    subject?: MappingExpression;
    tags?: MappingExpression;
    data: MappingExpression;
    dedupeKey?: {
      template: string;
    };
  }>;
  onGateFailure?: "skip" | "fail_run";
  priority?: number;
  createdAt: string;
  updatedAt: string;
  frontmatter?: Record<string, unknown>;
  body?: string;
  relativePath?: string;
  slug?: string;
  errors?: string[];
}

