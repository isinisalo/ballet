import { vi } from "vitest";
import type {
  InstalledLoopModuleStatus,
  LoopModuleInstallPlan,
  LoopModulePackageV3
} from "@shared/api/workspace-contracts";
import type { LoopModuleActions } from "../src/workspace/automation/loops/LoopLibraryDialog";

const modulePackage: LoopModulePackageV3 = {
  format: "ballet-loop-module",
  version: 3,
  manifest: {
    id: "installed-loop", title: "Installed Loop", description: "Installed module.", version: "1.0.0", tags: []
  },
  permissions: { network: "forbidden", externalWrites: false },
  profileSlots: [],
  stateContract: {
    id: "installed-state", version: "1.0.0", description: "Installed state.", initial: {}, requiredKeys: []
  },
  capabilities: {
    requires: [], accepts: ["installed:task.requested"],
    provides: ["installed:task.completed"], recommendedTransitions: [], recommendedRepairs: []
  },
  resources: [],
  loop: {
    key: "loop", description: "Installed module.", state: { description: "Installed state.", initial: {} },
    workflow: {
      startJobNode: "job",
      jobNodes: [{
        key: "job", validationNode: "job-validation", description: "Job.", type: "human", task: "Job.",
        nodeStyle: "terra", nodeSize: "medium", maxRetries: 3
      }],
      validationNodes: [{
        key: "job-validation", description: "Validate.", type: "human", task: "Validate.",
        nodeStyle: "luna", nodeSize: "small"
      }],
      passEdges: [{ key: "job-pass", sourceValidationNode: "job-validation", target: { workflowResult: "PASS" } }],
      failEdges: [{ key: "job-fail", sourceValidationNode: "job-validation", target: { workflowResult: "FAIL" } }]
    }
  }
};

export const installedStatus: InstalledLoopModuleStatus = {
  moduleId: "installed-loop", moduleVersion: "1.0.0", title: "Installed Loop",
  source: ".ballet/loop-library/installed.ballet-loop.json",
  packageSha256: "a".repeat(64), loopId: "installed-loop", installedAt: "2026-08-16T00:00:00.000Z",
  profileMappings: {}, idRemapping: { loop: { loop: "installed-loop" }, nodes: {}, edges: {}, instructions: {}, skills: {} },
  stateContract: modulePackage.stateContract, capabilities: modulePackage.capabilities, ownedResources: [],
  installedContentSha256: "b".repeat(64), status: "exact", currentContentSha256: "b".repeat(64), missingResources: []
};

export function loopModuleActions(): LoopModuleActions {
  const plan: LoopModuleInstallPlan = {
    planHash: "c".repeat(64), packageSha256: installedStatus.packageSha256,
    source: installedStatus.source, module: modulePackage.manifest,
    loop: {
      id: installedStatus.loopId, description: modulePackage.loop.description,
      capabilities: { accepts: [], provides: [] }, state: modulePackage.loop.state,
      workflow: { startJobNodeId: "job", jobNodes: [], validationNodes: [], passEdges: [], failEdges: [] }
    },
    idRemapping: installedStatus.idRemapping, resources: [], profileMappings: [],
    permissions: { externalWrites: false, network: "forbidden", compatible: true },
    stateContract: { contract: modulePackage.stateContract, compatibility: "compatible", comparedWith: [] },
    capabilities: { ...modulePackage.capabilities, available: [], missingRequires: [] }, conflicts: [], issues: [],
    diff: {
      loopsAdded: [installedStatus.loopId], projectFilesCreated: [],
      provenanceFilesChanged: [".ballet/loop-modules/installed.json"], projectConfigChanged: true
    },
    requiresPreview: false, canInstall: true
  };
  return {
    listLibrary: vi.fn(async () => [{
      source: installedStatus.source, sha256: installedStatus.packageSha256, sizeBytes: 100,
      valid: true, manifest: modulePackage.manifest, permissions: modulePackage.permissions,
      package: modulePackage, issues: []
    }]),
    inspect: vi.fn(), plan: vi.fn(async () => plan), install: vi.fn(async () => installedStatus),
    statuses: vi.fn(async () => [installedStatus]), exportLoop: vi.fn(), remove: vi.fn()
  };
}
