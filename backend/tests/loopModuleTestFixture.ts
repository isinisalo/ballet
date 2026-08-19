import type { LoopModulePackageV1 } from "../../shared/domain/loopModules.js";

export const testLoopModulePackage = (overrides: Partial<LoopModulePackageV1> = {}): LoopModulePackageV1 => ({
  format: "ballet-loop-module",
  version: 1,
  manifest: {
    id: "sample-loop",
    title: "Sample Loop",
    description: "Perform and validate one portable sample task.",
    version: "1.0.0",
    category: "test",
    tags: ["sample"]
  },
  permissions: { network: "forbidden", externalWrites: false },
  profileSlots: [{
    key: "worker",
    title: "Worker",
    description: "A network-off Codex worker.",
    providers: ["codex"],
    network: "forbidden"
  }],
  stateContract: {
    id: "sample-state",
    version: "1.0.0",
    description: "Sample state shared by this Loop.",
    initial: { complete: false },
    requiredKeys: ["complete"]
  },
  capabilities: {
    requires: [],
    accepts: ["sample:task.requested"],
    provides: ["sample:task.completed"],
    recommendedConnections: []
  },
  resources: [
    { kind: "instruction", key: "worker", title: "Sample worker", metadata: {}, body: "Perform the sample work.\n" },
    { kind: "skill", key: "sample", name: "sample", description: "Complete sample work.", metadata: {}, body: "# Sample\n\nComplete the sample work.\n" }
  ],
  loop: {
    key: "loop",
    description: "Perform and validate one portable sample task.",
    state: { description: "Sample state shared by this Loop.", initial: { complete: false } },
    startNode: "work",
    nodes: [{
      key: "work",
      description: "Perform and validate sample work.",
      work: {
        type: "agent", task: "Perform sample work.", profileSlot: "worker", primaryInstruction: "worker",
        skills: ["sample"], nodeStyle: "terra", nodeSize: "medium"
      },
      validation: {
        type: "human", task: "Validate sample work.", nodeStyle: "luna", nodeSize: "small"
      },
      maxLocalAttempts: 3
    }],
    edges: [{ key: "completed", source: "work", target: { terminal: "completed" } }]
  },
  ...overrides
});
