import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loopModulePackageV2Schema } from "../shared/api/loop-module-schemas.js";
import type { LoopModuleCapabilitiesV2 } from "../shared/domain/loopModules.js";
import { canonicalLoopModuleJson } from "../backend/loop-modules/canonicalLoopModule.js";
import { LoopModuleService } from "../backend/loop-modules/LoopModuleService.js";
import type { RuntimeDatabaseProvider } from "../backend/services/RuntimeDatabaseProvider.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, ".ballet", "loop-library", "arc42");
const inactiveRuntime = {
  runtimeDatabase: () => ({ activeLoopIds: () => [] })
} as unknown as RuntimeDatabaseProvider;
const service = new LoopModuleService(() => root, inactiveRuntime);
const capabilities = (
  accepts: string,
  provides: string,
  recommendedConnections: LoopModuleCapabilitiesV2["recommendedConnections"] = []
): LoopModuleCapabilitiesV2 => ({
  requires: accepts.endsWith(".requested") ? [] : [accepts],
  accepts: [accepts],
  provides: [provides],
  recommendedConnections
});

const definitions: Array<{
  loopId: string;
  title: string;
  capabilities: LoopModuleCapabilitiesV2;
}> = [
  {
    loopId: "arc42-clarify-requirements",
    title: "Clarify specification",
    capabilities: capabilities("arc42:initiative.requested", "arc42:requirements.clarified", [
      { kind: "flow", direction: "outgoing", capability: "arc42:requirements.clarified", description: "A clarified specification can satisfy a compatible downstream input." }
    ])
  },
  {
    loopId: "arc42-solution-strategy",
    title: "Solution strategy",
    capabilities: capabilities("arc42:requirements.clarified", "arc42:solution-strategy.designed", [
      { kind: "repair", direction: "outgoing", capability: "arc42:requirements.clarified", description: "Request clarified intent or a measurable quality target." },
      { kind: "flow", direction: "outgoing", capability: "arc42:solution-strategy.designed", description: "A validated strategy can satisfy a compatible downstream input." }
    ])
  },
  {
    loopId: "arc42-building-block-view",
    title: "Building Block View",
    capabilities: capabilities("arc42:solution-strategy.designed", "arc42:building-block-view.designed", [
      { kind: "repair", direction: "outgoing", capability: "arc42:solution-strategy.designed", description: "Request a strategy correction when block ownership cannot be resolved." },
      { kind: "flow", direction: "outgoing", capability: "arc42:building-block-view.designed", description: "A validated Building Block View can satisfy a compatible downstream input." }
    ])
  },
  {
    loopId: "arc42-runtime-deployment",
    title: "Runtime and deployment",
    capabilities: capabilities("arc42:building-block-view.designed", "arc42:runtime-deployment.designed", [
      { kind: "repair", direction: "outgoing", capability: "arc42:building-block-view.designed", description: "Request a static-structure correction exposed by a significant scenario." },
      { kind: "flow", direction: "outgoing", capability: "arc42:runtime-deployment.designed", description: "Validated significant scenarios can satisfy a compatible downstream input." }
    ])
  },
  {
    loopId: "arc42-crosscutting-concepts",
    title: "Crosscutting concepts",
    capabilities: capabilities("arc42:runtime-deployment.designed", "arc42:concepts.designed", [
      { kind: "repair", direction: "outgoing", capability: "arc42:runtime-deployment.designed", description: "Request a structural scenario correction exposed by concept design." },
      { kind: "flow", direction: "outgoing", capability: "arc42:concepts.designed", description: "Validated concepts can satisfy a compatible downstream input." }
    ])
  },
  {
    loopId: "arc42-architecture-decision",
    title: "Architecture decision",
    capabilities: capabilities("arc42:concepts.designed", "arc42:architecture-decision.recorded", [
      { kind: "repair", direction: "outgoing", capability: "arc42:concepts.designed", description: "Request concept clarification required by a significant decision." },
      { kind: "flow", direction: "outgoing", capability: "arc42:architecture-decision.recorded", description: "An explicit decision status can satisfy a compatible downstream input." }
    ])
  },
  {
    loopId: "arc42-communicate-document",
    title: "Communicate and document",
    capabilities: capabilities("arc42:architecture-decision.recorded", "arc42:architecture.communicated", [
      { kind: "repair", direction: "outgoing", capability: "arc42:architecture-decision.recorded", description: "Request an explicit decision status exposed by communication." },
      { kind: "flow", direction: "outgoing", capability: "arc42:architecture.communicated", description: "An approved handoff can satisfy a compatible downstream input." }
    ])
  },
  {
    loopId: "arc42-accompany-implementation",
    title: "Accompany implementation",
    capabilities: capabilities("arc42:architecture.communicated", "arc42:implementation.accepted", [
      { kind: "repair", direction: "outgoing", capability: "arc42:architecture.communicated", description: "Request a corrected implementation handoff." },
      { kind: "flow", direction: "outgoing", capability: "arc42:implementation.accepted", description: "Accepted implementation evidence can satisfy a compatible downstream input." }
    ])
  },
  {
    loopId: "arc42-analyze-evaluate",
    title: "Analyze and evaluate",
    capabilities: capabilities("arc42:implementation.accepted", "arc42:evaluation.completed", [
      { kind: "repair", direction: "outgoing", capability: "arc42:implementation.accepted", description: "Request corrected implementation or acceptance evidence." }
    ])
  },
  {
    loopId: "arc42-continuous-learning",
    title: "Continuous learning",
    capabilities: capabilities("arc42:research.requested", "arc42:research.findings", [
      { kind: "repair", direction: "outgoing", capability: "arc42:evaluation.completed", description: "Request evaluation of material authoritative evidence." }
    ])
  }
];

await mkdir(target, { recursive: true });
for (const definition of definitions) {
  const exported = await service.exportLoop({
    loopId: definition.loopId,
    title: definition.title,
    version: "1.0.0",
    category: "arc42",
    tags: ["arc42", "method"]
  });
  const pkg = loopModulePackageV2Schema.parse({
    ...exported.package,
    stateContract: {
      id: "arc42-method-state",
      version: "1.0.0",
      description: "Arc42MethodStateV1 bounded references shared between independently installed arc42 activity Loops.",
      initial: exported.package.loop.state.initial,
      requiredKeys: ["architecture", "delivery", "evaluation", "handoff", "initiative", "release"]
    },
    capabilities: definition.capabilities
  });
  await writeFile(path.join(target, `${definition.loopId}.ballet-loop.json`), canonicalLoopModuleJson(pkg), "utf8");
}
