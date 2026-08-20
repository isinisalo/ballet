import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loopModulePackageV1Schema } from "../shared/api/loop-module-schemas.js";
import type { JsonValue } from "../shared/domain/automation.js";
import type { LoopModulePackageV1 } from "../shared/domain/loopModules.js";
import { canonicalLoopModuleJson } from "../backend/loop-modules/canonicalLoopModule.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, ".ballet", "loop-library", "software-engineering");
const softwareDelivery = path.join(root, ".ballet", "loop-library", "software-delivery");
const initialState = {
  contractVersion: "SoftwareEngineeringStateV1",
  request: null,
  status: "not_started",
  artifacts: [],
  checks: [],
  evidence: []
} satisfies JsonValue;
const stateContract: LoopModulePackageV1["stateContract"] = {
  id: "software-engineering-state",
  version: "1.0.0",
  description: "Bounded software-engineering request, artifact, check and evidence references shared by capability-compatible starter Loops.",
  initial: initialState,
  requiredKeys: ["artifacts", "checks", "contractVersion", "evidence", "request", "status"]
};

interface Starter {
  id: string;
  title: string;
  description: string;
  accepts: string;
  provides: string;
  task: string;
  validation: string;
  instruction: string;
  skill: string;
  human?: boolean;
}

const starters: Starter[] = [
  {
    id: "clarify-specification",
    title: "Clarify specification",
    description: "Clarify one bounded specification. Done when intent, scope, constraints, acceptance measures and unresolved human decisions are explicit and independently validated.",
    accepts: "software:specification.requested",
    provides: "software:specification.clarified",
    task: "Clarify one bounded specification from accepted sources and explicit human input. Record intent, scope, non-goals, constraints, measurable acceptance criteria and open decisions. Done means no acceptance-critical ambiguity is hidden.",
    validation: "Validate that the bounded specification is source-linked, measurable and explicit about every unresolved human-owned decision. Do not edit it.",
    instruction: "Clarify one bounded software specification without inventing intent. Separate facts, decisions, assumptions and open questions; stop for missing human-owned scope or acceptance measures.",
    skill: "Check that the specification names one outcome, scope, non-goals, constraints, measurable acceptance criteria and unresolved decisions."
  },
  {
    id: "solution-strategy",
    title: "Solution strategy",
    description: "Define one bounded solution strategy. Done when the approach, decision drivers, material alternatives and unresolved significant choices are explicit and validated.",
    accepts: "architecture:strategy.requested",
    provides: "architecture:solution-strategy.ready",
    task: "Define the smallest solution strategy for the bounded request. Link decision drivers, constraints and measurable quality criteria; record material alternatives and unresolved significant choices. Done means implementation direction is explicit without designing unrelated detail.",
    validation: "Validate that the strategy is bounded, evidence-linked and sufficient for its stated drivers without hiding a significant decision. Do not edit it.",
    instruction: "Design one quality-driven solution strategy. Do not expand into detailed component, runtime, UI or deployment design unless the bounded request requires it.",
    skill: "Trace one strategy from explicit drivers to the chosen approach, alternatives, consequences and open significant choices."
  },
  {
    id: "architecture-decision",
    title: "Architecture decision",
    description: "Resolve one architecture-significant choice. Done when its decision drivers, alternatives, decision status, consequences and supersession boundary are explicit and human-approved where required.",
    accepts: "architecture:decision.requested",
    provides: "architecture:decision.recorded",
    task: "Prepare one architecture-significant decision from accepted drivers and evidence. Record alternatives, consequences and any superseded scope; never modify an accepted decision silently. Done requires an explicit accepted, rejected, proposal or no-decision-needed status.",
    validation: "Accept or reject the proposed architecture decision, or explicitly confirm that no new decision is needed. Unmentioned external actions and decision changes remain unauthorized.",
    instruction: "Prepare one architecture decision without inventing WHAT/WHY or acceptance. Accepted status always requires explicit human approval.",
    skill: "Verify decision significance, drivers, options, consequences, evidence, review trigger and explicit supersession."
  },
  {
    id: "ui-mock",
    title: "UI mock",
    description: "Create one bounded UI mock. Done when the requested user flow, key states and responsive intent are visible and validated without claiming production behavior.",
    accepts: "ui:mock.requested",
    provides: "ui:mock.ready",
    task: "Create a bounded UI mock for the requested user flow using the project's existing design direction. Show key states and desktop/narrow intent. Done means stakeholders can validate information hierarchy and interaction intent without mistaking the mock for production behavior.",
    validation: "Validate the mock against the requested user flow, key states, information hierarchy, accessibility intent and responsive scope. Do not edit the mock or infer implemented behavior.",
    instruction: "Create one reviewable UI mock using project design sources. Keep speculative behavior labeled and avoid unrelated visual-system changes.",
    skill: "Check user flow, key states, hierarchy, accessibility intent, responsive framing and explicit mock limitations."
  },
  {
    id: "ui-design",
    title: "UI design",
    description: "Specify one bounded production UI design. Done when components, tokens, states, accessibility and responsive behavior are explicit and validated against the user flow.",
    accepts: "ui:design.requested",
    provides: "ui:design.ready",
    task: "Design one production UI slice using the project's canonical design system and component patterns. Specify states, interactions, accessibility, responsive behavior and implementation boundaries. Done means the design is implementable without ad hoc visual decisions.",
    validation: "Validate the design against the user flow, canonical tokens, component conventions, accessibility semantics and desktop/narrow behavior. Do not edit the design.",
    instruction: "Design one bounded production UI slice from canonical design tokens and existing component patterns. Do not create a parallel visual language.",
    skill: "Check component reuse, token use, interaction states, keyboard and semantic accessibility, responsive behavior and implementation handoff."
  },
  {
    id: "implementation",
    title: "Implementation",
    description: "Implement one bounded change. Done when requested behavior, tests, architecture conformance and concrete check evidence are complete without external release actions.",
    accepts: "implementation:change.requested",
    provides: "implementation:change.ready",
    task: "Implement one bounded change using the repository's accepted architecture and existing patterns. Remove replaced code in scope and run relevant tests. Done means the requested behavior and acceptance checks pass with no blocking conformance drift.",
    validation: "Independently validate the diff, behavior, tests and architecture conformance for the bounded request. Do not edit the implementation or authorize release, deploy, merge or push.",
    instruction: "Implement one bounded repository change with tests and concrete evidence. Preserve unrelated work and never broaden authority to external writes.",
    skill: "Trace the bounded request through changed artifacts, tests, conformance findings and exact check results."
  },
  {
    id: "deploy-dev",
    title: "Deploy to dev environment",
    description: "Perform one exactly authorized deployment to a named development environment through Human Work. Done when authorization, target, deployment result, health checks and rollback status are explicitly validated.",
    accepts: "deployment:dev.requested",
    provides: "deployment:dev.completed",
    task: "After an exact human authorization names the development environment, version, actions and limits, perform only that authorized deployment manually and record non-secret evidence. If authorization is missing or incomplete, return needs_input without acting.",
    validation: "Validate the named development deployment against the exact authorization, target, version, health checks and rollback readiness. Do not infer permission for rollback, release, merge or push.",
    instruction: "",
    skill: "",
    human: true
  }
];

const agentPackage = (starter: Starter): LoopModulePackageV1 => {
  const resources: LoopModulePackageV1["resources"] = starter.human ? [] : [
    { kind: "instruction", key: "worker", title: `${starter.title} worker`, metadata: {}, body: `${starter.instruction}\n` },
    { kind: "skill", key: "task", name: `${starter.id}-task`, description: `Complete and verify the ${starter.title} responsibility.`, metadata: {}, body: `# ${starter.title}\n\n${starter.skill}\n` }
  ];
  const work: LoopModulePackageV1["loop"]["nodes"][number]["work"] = starter.human
    ? { type: "human", task: starter.task, nodeStyle: "terra", nodeSize: "medium" }
    : {
        type: "agent", task: starter.task, profileSlot: "worker", primaryInstruction: "worker",
        skills: ["task"], nodeStyle: "terra", nodeSize: "medium"
      };
  return {
    format: "ballet-loop-module",
    version: 1,
    manifest: { id: starter.id, title: starter.title, description: starter.description, version: "1.0.0", category: "software-engineering", tags: ["software-engineering", "starter"] },
    permissions: { network: "forbidden", externalWrites: false },
    profileSlots: starter.human ? [] : [{ key: "worker", title: "Worker", description: "Network-off implementation profile.", providers: ["codex", "copilot"], network: "forbidden" }],
    stateContract,
    capabilities: { requires: [], accepts: [starter.accepts], provides: [starter.provides], recommendedConnections: [] },
    resources,
    loop: {
      key: "loop",
      description: starter.description,
      state: { description: stateContract.description, initial: initialState },
      startNode: "task",
      nodes: [{
        key: "task", description: starter.description, work,
        validation: starter.human
          ? { type: "human", task: starter.validation, nodeStyle: "luna", nodeSize: "small" }
          : { type: "human", task: starter.validation, nodeStyle: "luna", nodeSize: "small" },
        maxLocalAttempts: 3
      }],
      edges: [{ key: "completed", source: "task", target: { terminal: "completed" } }]
    }
  };
};

await mkdir(target, { recursive: true });
for (const starter of starters) {
  const parsed = loopModulePackageV1Schema.parse(agentPackage(starter));
  await writeFile(path.join(target, `${starter.id}.ballet-loop.json`), canonicalLoopModuleJson(parsed), "utf8");
}

for (const filename of ["backend-implementation.ballet-loop.json", "frontend-implementation.ballet-loop.json"]) {
  const source = path.join(softwareDelivery, filename);
  const pkg = JSON.parse(await readFile(source, "utf8")) as LoopModulePackageV1;
  const description = filename.startsWith("backend-")
    ? "Implement one bounded backend change. Done when requested domain, API and persistence behavior, compatibility, tests and concrete check evidence are independently validated."
    : "Implement one bounded frontend change. Done when the requested user flow, API contract, design-system use, accessibility, responsive behavior, tests and concrete check evidence are independently validated.";
  pkg.manifest.version = "2.0.0";
  pkg.manifest.description = description;
  pkg.loop.description = description;
  pkg.stateContract = stateContract;
  pkg.loop.state = { description: stateContract.description, initial: initialState };
  pkg.capabilities = {
    requires: [],
    accepts: ["implementation:change.requested"],
    provides: ["implementation:change.ready"],
    recommendedConnections: []
  };
  const parsed = loopModulePackageV1Schema.parse(pkg);
  await writeFile(source, canonicalLoopModuleJson(parsed), "utf8");
}
