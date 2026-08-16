import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loopModulePackageV1Schema } from "../shared/api/loop-module-schemas.js";
import type { LoopModuleCapabilitiesV1 } from "../shared/domain/loopModules.js";
import { canonicalLoopModuleJson } from "../backend/loop-modules/canonicalLoopModule.js";
import { LoopModuleService } from "../backend/loop-modules/LoopModuleService.js";
import type { RuntimeDatabaseProvider } from "../backend/services/RuntimeDatabaseProvider.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, ".ballet", "loop-library", "arc42");
const inactiveRuntime = {
  runtimeDatabase: () => ({ activeLoopIds: () => [] })
} as unknown as RuntimeDatabaseProvider;
const service = new LoopModuleService(() => root, inactiveRuntime);

const definitions: Array<{
  loopId: string;
  title: string;
  capabilities: LoopModuleCapabilitiesV1;
}> = [
  {
    loopId: "arc42-clarify-requirements",
    title: "Clarify requirements",
    capabilities: {
      requires: [], provides: ["arc42.requirements-clarified"],
      recommendedConnections: [{ kind: "flow", direction: "outgoing", capability: "arc42.structures-designed", description: "Continue from an approved BRIEF and measurable quality scenarios to structural design." }]
    }
  },
  {
    loopId: "arc42-design-structures",
    title: "Design structures",
    capabilities: {
      requires: ["arc42.requirements-clarified"], provides: ["arc42.structures-designed"],
      recommendedConnections: [
        { kind: "repair", direction: "outgoing", capability: "arc42.requirements-clarified", description: "Request clarification when a structural decision lacks intent or a measurable quality target." },
        { kind: "flow", direction: "outgoing", capability: "arc42.concepts-designed", description: "Continue from reviewed structures to cross-cutting concepts." }
      ]
    }
  },
  {
    loopId: "arc42-design-concepts",
    title: "Design cross-cutting concepts",
    capabilities: {
      requires: ["arc42.structures-designed"], provides: ["arc42.concepts-designed"],
      recommendedConnections: [
        { kind: "repair", direction: "outgoing", capability: "arc42.requirements-clarified", description: "Request a missing quality criterion needed to choose a concept." },
        { kind: "repair", direction: "outgoing", capability: "arc42.structures-designed", description: "Repair a building block or interface exposed by concept design." },
        { kind: "flow", direction: "outgoing", capability: "arc42.architecture-communicated", description: "Continue reviewed concepts to architecture communication." }
      ]
    }
  },
  {
    loopId: "arc42-communicate-document",
    title: "Communicate and document",
    capabilities: {
      requires: ["arc42.concepts-designed"], provides: ["arc42.architecture-communicated"],
      recommendedConnections: [
        { kind: "repair", direction: "outgoing", capability: "arc42.requirements-clarified", description: "Clarify intent exposed during communication." },
        { kind: "repair", direction: "outgoing", capability: "arc42.structures-designed", description: "Repair an unclear architecture view." },
        { kind: "repair", direction: "outgoing", capability: "arc42.concepts-designed", description: "Repair an unclear concept or decision." },
        { kind: "flow", direction: "outgoing", capability: "arc42.implementation-accompanied", description: "Continue an approved handoff to bounded implementation." }
      ]
    }
  },
  {
    loopId: "arc42-accompany-implementation",
    title: "Accompany implementation",
    capabilities: {
      requires: ["arc42.architecture-communicated"], provides: ["arc42.implementation-accompanied"],
      recommendedConnections: [
        { kind: "repair", direction: "outgoing", capability: "arc42.requirements-clarified", description: "Clarify scope or acceptance discovered during implementation." },
        { kind: "repair", direction: "outgoing", capability: "arc42.structures-designed", description: "Repair a structural gap exposed by code." },
        { kind: "repair", direction: "outgoing", capability: "arc42.concepts-designed", description: "Repair a cross-cutting concept exposed by code." },
        { kind: "flow", direction: "outgoing", capability: "arc42.architecture-evaluated", description: "Continue accepted implementation evidence to evaluation." }
      ]
    }
  },
  {
    loopId: "arc42-analyze-evaluate",
    title: "Analyze and evaluate",
    capabilities: {
      requires: ["arc42.implementation-accompanied"], provides: ["arc42.architecture-evaluated"],
      recommendedConnections: [
        { kind: "repair", direction: "outgoing", capability: "arc42.requirements-clarified", description: "Clarify criteria required for evaluation." },
        { kind: "repair", direction: "outgoing", capability: "arc42.structures-designed", description: "Repair architecture drift in structures." },
        { kind: "repair", direction: "outgoing", capability: "arc42.concepts-designed", description: "Repair a concept or reassess a decision." },
        { kind: "repair", direction: "outgoing", capability: "arc42.implementation-accompanied", description: "Repair implementation or evidence gaps." }
      ]
    }
  },
  {
    loopId: "arc42-continuous-learning",
    title: "Continuous learning",
    capabilities: {
      requires: [], provides: ["arc42.authoritative-learning"],
      recommendedConnections: [
        { kind: "repair", direction: "outgoing", capability: "arc42.requirements-clarified", description: "Clarify the quality impact of authoritative evidence." },
        { kind: "repair", direction: "outgoing", capability: "arc42.structures-designed", description: "Assess a material structural technology finding." },
        { kind: "repair", direction: "outgoing", capability: "arc42.concepts-designed", description: "Assess a material cross-cutting technology or method finding." },
        { kind: "repair", direction: "outgoing", capability: "arc42.architecture-evaluated", description: "Evaluate material learning evidence against quality, risk and debt." }
      ]
    }
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
  const pkg = loopModulePackageV1Schema.parse({
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
