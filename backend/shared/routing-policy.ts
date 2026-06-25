import type { Condition } from "./conditions.js";
import type { MappingExpression } from "./mapping.js";
import type { VersionedRef } from "./json.js";

export interface RoutingPolicy {
  id: string;
  name: string;
  description: string;
  active: boolean;
  consumes: {
    eventType: string;
  };
  when?: Condition;
  dispatch: {
    operation: VersionedRef;
  };
  input: MappingExpression;
  priority?: number;
  selection?: {
    mode: "fanout" | "exclusive";
    group?: string;
  };
  onInvalidInput?: "skip" | "reject-event";
  createdAt: string;
  updatedAt: string;
  frontmatter?: Record<string, unknown>;
  body?: string;
  relativePath?: string;
  slug?: string;
  errors?: string[];
}

