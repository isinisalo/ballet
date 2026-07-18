import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import { agentOutcomeSchema } from "../../shared/api/runtime-schemas.js";
import {
  getProjectStepTransitionEntries,
  isProjectTerminalNode,
  type ProjectAutomationConfig,
  type ProjectStep,
  type TransitionAction
} from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { AgentOutcome, LoopRunDetails, StepRun } from "../../shared/domain/runtime.js";
import { validateProjectAutomationConfig } from "../../backend/automation/validateAutomationConfig.js";
import { loadMarkdownAppData } from "../../backend/markdown-adapter.js";
import { RuntimeDatabase } from "../../backend/runtime-db.js";

const ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const FIXTURES = path.join(ROOT, ".ballet/evals/fixtures");
const SOURCE_REQUIREMENTS = ".ballet/contracts/blueprint-source-requirements.yaml";
const SOURCE_VALIDATOR = ".agents/skills/source-contract-audit/scripts/validate.mjs";
const SHA256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const writeResults = process.argv.includes("--write-results");

interface EvalRecord {
  case: string;
  loop_step: string;
  agent: string;
  expected_outcome: string;
  actual_outcome: string;
  artifacts: string[];
  approval_boundary: string;
  result: "passed" | "failed";
  gap: string | null;
  details?: string;
}

const records: EvalRecord[] = [];
const temporaryRoots: string[] = [];
const project = projectConfigSchema.parse(JSON.parse(await readFile(path.join(ROOT, ".ballet/project.json"), "utf8")));
const automation: ProjectAutomationConfig = { version: 8, loops: project.loops };
const workspace = await loadMarkdownAppData(ROOT);
const fixtureOutcomes = parseYaml(await readFile(path.join(FIXTURES, "agent-outcomes.yaml"), "utf8")).outcomes as Record<string, AgentOutcome>;
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();

const runCase = async (
  metadata: Omit<EvalRecord, "actual_outcome" | "result" | "details">,
  execute: () => Promise<string | { outcome: string; details?: string }>
) => {
  try {
    const value = await execute();
    const actual = typeof value === "string" ? value : value.outcome;
    assert.equal(actual, metadata.expected_outcome);
    records.push({ ...metadata, actual_outcome: actual, result: "passed", ...(typeof value === "object" && value.details ? { details: value.details } : {}) });
  } catch (error) {
    records.push({
      ...metadata,
      actual_outcome: "evaluation_failed",
      result: "failed",
      details: error instanceof Error ? error.stack ?? error.message : String(error)
    });
  }
};

const materializeFixture = async (name: string) => {
  const bundle = parseYaml(await readFile(path.join(FIXTURES, name), "utf8")) as {
    source_sha?: string;
    files: Record<string, string>;
  };
  const root = await mkdtemp(path.join(tmpdir(), "ballet-project-eval-fixture-"));
  temporaryRoots.push(root);
  const snapshotLiteral = [
    "source_snapshot:",
    "  path: .ballet/outputs/source-snapshot.yaml",
    "  sha256: \"@SHA256:.ballet/outputs/source-snapshot.yaml@\""
  ].join("\n");
  for (const [relative, raw] of Object.entries(bundle.files)) {
    let content = raw
      .replaceAll("@SOURCE_SHA@", bundle.source_sha ?? "0".repeat(40))
      .replace(/^source_snapshot: \*snapshot$/gm, snapshotLiteral);
    content = content.replace(/@SHA256:([^@]+)@/g, (_match, dependency: string) => {
      const absolute = path.resolve(root, dependency);
      const relativeDependency = path.relative(root, absolute);
      if (relativeDependency.startsWith("..") || path.isAbsolute(relativeDependency) || !existsSync(absolute)) {
        throw new Error(`Fixture ${relative} references an unavailable dependency: ${dependency}`);
      }
      return SHA256(readFileSync(absolute));
    });
    assert(!content.includes("@SHA256:"), `Unresolved fixture hash in ${relative}`);
    const target = path.resolve(root, relative);
    const relativeTarget = path.relative(root, target);
    assert(!relativeTarget.startsWith("..") && !path.isAbsolute(relativeTarget), `Fixture path escapes root: ${relative}`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
  return root;
};

const validator = (script: string, root: string, args: string[]) => {
  const invocation = spawnSync(process.execPath, [path.join(ROOT, script), "--root", root, ...args], {
    cwd: ROOT,
    encoding: "utf8"
  });
  const output = invocation.stdout.trim().split("\n").filter(Boolean).at(-1);
  assert(output, `Validator ${script} emitted no JSON. stderr=${invocation.stderr}`);
  const parsed = JSON.parse(output) as {
    outcome: string;
    result: string;
    issues: Array<{ code: string; message: string }>;
    evidence: Record<string, unknown>;
  };
  assert([0, 1].includes(invocation.status ?? -1), `Validator ${script} exited ${invocation.status}: ${invocation.stderr}`);
  return parsed;
};

const seedRootRun = (runtime: RuntimeDatabase, loopId: string, worktreePath: string) => {
  const rootRunId = randomUUID();
  const timestamp = new Date(0).toISOString();
  runtime.connection().prepare(`
    INSERT INTO root_runs (
      root_run_id, kind, target_id, source, status, worktree_path, branch, head_sha,
      config_hash, snapshot_hash, created_at, updated_at
    ) VALUES (?, 'loop', ?, 'manual', 'queued', ?, ?, ?, 'configuration-eval', 'configuration-eval', ?, ?)
  `).run(rootRunId, loopId, worktreePath, `eval/${rootRunId}`, head, timestamp, timestamp);
  return rootRunId;
};

const withRuntime = async <T>(execute: (runtime: RuntimeDatabase, root: string) => Promise<T> | T): Promise<T> => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-project-eval-runtime-"));
  temporaryRoots.push(root);
  const runtime = new RuntimeDatabase(path.join(root, "runtime.sqlite"));
  try { return await execute(runtime, root); }
  finally { runtime.close(); }
};

const isolatedAutomation = (loopId: string, stepId: string): ProjectAutomationConfig => {
  const isolated = structuredClone(automation);
  const loop = isolated.loops.find((candidate) => candidate.id === loopId);
  assert(loop, `Unknown loop ${loopId}`);
  loop.start = stepId;
  return isolated;
};

const startAt = (runtime: RuntimeDatabase, root: string, loopId: string, stepId: string, input = "fixture-input") => {
  const config = isolatedAutomation(loopId, stepId);
  const rootRunId = seedRootRun(runtime, loopId, root);
  const run = runtime.startLoopRun(config, loopId, defaultLoopTheme, rootRunId, input);
  return { config, rootRunId, run };
};

const activeRootRun = (runtime: RuntimeDatabase, rootRunId: string) => runtime.listRootLoopRuns(rootRunId)
  .findLast((run) => run.status === "running" || run.status === "waiting_for_human");

const activeStep = (run: LoopRunDetails) => run.stepRuns.findLast((step) => ["queued", "running", "waiting_for_human"].includes(step.status));

const configuredOutcome = (signal: string, action: TransitionAction, evidence = "base"): AgentOutcome => {
  const key = signal === "failed"
    ? action.action === "retry" && action.policy.when?.failureClassification === "transient" ? "failed-transient" : "failed-permanent"
    : signal;
  const base = structuredClone(fixtureOutcomes[key]);
  assert(base, `Missing fixture outcome ${key}`);
  if (signal === "changes-requested") {
    base.summary = `Fixture repair ${evidence}`;
    base.artifacts = { evidence_revision: evidence };
    base.checks = [{ name: "fixture", status: "failed", details: `repair-${evidence}` }];
  }
  return agentOutcomeSchema.parse(base);
};

const checkerSteps = new Set(["independent-blueprint-verifier", "run-acceptance-tests"]);
const successOutcomeFor = (stepId: string) => checkerSteps.has(stepId)
  ? structuredClone(fixtureOutcomes.approved)
  : structuredClone(fixtureOutcomes.ready);

const assertTransition = (persisted: StepRun, action: TransitionAction, sourceStepId: string) => {
  assert(persisted.transition, `No transition persisted for ${sourceStepId}`);
  if (action.action === "goto") {
    assert.equal(persisted.transition.action, "goto");
    if (persisted.transition.action === "goto") assert.deepEqual(persisted.transition.target, action.target);
  } else if (action.action === "terminate") {
    assert.equal(persisted.transition.action, "terminate");
    if (persisted.transition.action === "terminate") assert.equal(persisted.transition.status, action.status);
  } else if (action.action === "wait") {
    assert.equal(persisted.transition.action, "wait");
    if (persisted.transition.action === "wait") assert.deepEqual(persisted.transition.resume, action.resume);
  } else {
    assert.equal(persisted.transition.action, "retry");
    if (persisted.transition.action === "retry") {
      assert.equal(persisted.transition.target, action.target ?? sourceStepId);
      assert.equal(persisted.transition.attempt, 1);
      assert.equal(persisted.transition.maxAttempts, action.policy.maxAttempts);
    }
  }
};

const driveToHuman = (runtime: RuntimeDatabase, config: ProjectAutomationConfig, rootRunId: string, visited?: Set<string>) => {
  for (let guard = 0; guard < 100; guard += 1) {
    const run = activeRootRun(runtime, rootRunId);
    assert(run, "No active Run before human gate.");
    const step = activeStep(run);
    assert(step, "No active Step before human gate.");
    if (step.type === "human") return { run, step };
    visited?.add(step.agentId ?? "");
    runtime.completeAgentStep(config, defaultLoopTheme, {
      stepRunId: step.stepRunId,
      outcome: agentOutcomeSchema.parse(successOutcomeFor(step.stepId))
    });
  }
  throw new Error("driveToHuman exceeded its guard.");
};

const approveHuman = (
  runtime: RuntimeDatabase,
  config: ProjectAutomationConfig,
  run: LoopRunDetails,
  step: StepRun,
  input: string
) => runtime.respondToStepRun(config, defaultLoopTheme, run.runId, step.stepRunId, "approved", input);

const rejectHuman = (
  runtime: RuntimeDatabase,
  config: ProjectAutomationConfig,
  run: LoopRunDetails,
  step: StepRun,
  input: string
) => runtime.respondToStepRun(config, defaultLoopTheme, run.runId, step.stepRunId, "rejected", input);

await runCase({
  case: "CONFIG-STRUCTURE",
  loop_step: "all Loops / all Steps",
  agent: "all configured agents",
  expected_outcome: "valid",
  artifacts: [".ballet/project.json", ".codex/agents/*.toml"],
  approval_boundary: "Schema and semantic references must validate before any Run.",
  gap: null
}, async () => {
  const issues = validateProjectAutomationConfig(automation, workspace.agents);
  assert.deepEqual(issues, []);
  const loopAgents = new Set(automation.loops.flatMap((loop) => loop.nodes.flatMap((node) => !isProjectTerminalNode(node) && node.type !== "human" ? [node.agentId] : [])));
  const configuredAgents = new Set(workspace.agents.map((agent) => agent.id));
  assert.deepEqual([...loopAgents].filter((id) => !configuredAgents.has(id)), []);
  assert.equal(loopAgents.size, Object.keys(project.agents).length);
  return "valid";
});

await runCase({
  case: "AGENT-SKILL-BOUNDARIES",
  loop_step: "all agent Steps",
  agent: "10 agents / 9 skills",
  expected_outcome: "enforced",
  artifacts: [".codex/agents/*.toml", ".agents/skills/*/SKILL.md", ".agents/skills/*/scripts/validate.mjs"],
  approval_boundary: "Authors return ready; only two independent checker Steps may return approved, while release approval stays human-owned.",
  gap: null
}, async () => {
  const usedSkills = new Set<string>();
  for (const agent of workspace.agents) {
    const source = readFileSync(path.join(ROOT, ".codex/agents", `${agent.id}.toml`), "utf8");
    assert(!source.includes("kerran uudelleen"), `${agent.id} duplicates a numeric retry limit outside project.json`);
    for (const match of source.matchAll(/path = "(\.agents\/skills\/[^"]+)"/g)) {
      usedSkills.add(match[1]);
      assert(existsSync(path.join(ROOT, match[1], "SKILL.md")));
      assert(existsSync(path.join(ROOT, match[1], "scripts/validate.mjs")));
    }
  }
  assert.equal(usedSkills.size, 9);
  for (const policyPath of [".agents/skills/_shared/blueprint-governance.md", ".ballet/instructions/loop-engineer-minimal.md"]) {
    const source = readFileSync(path.join(ROOT, policyPath), "utf8");
    assert(!/retry one transient|enintään kolme kertaa|yritetään kerran uudelleen/i.test(source), `${policyPath} duplicates a numeric retry limit`);
  }
  for (const loop of automation.loops) {
    for (const node of loop.nodes) {
      if (isProjectTerminalNode(node) || node.type === "human") continue;
      if (checkerSteps.has(node.id)) {
        assert.equal(node.on.ready.action, "terminate", `${node.id}.ready must not bypass checker approval`);
        assert.equal(node.on.approved.action, "goto", `${node.id}.approved must reach its gate`);
      } else {
        assert.equal(node.on.approved.action, "terminate", `${node.id} maker must not self-approve`);
      }
    }
  }
  const delivery = automation.loops.find((loop) => loop.id === "milestone-delivery")!;
  assert.notEqual(
    (delivery.nodes.find((node) => node.id === "implement-milestone") as ProjectStep & { agentId: string }).agentId,
    (delivery.nodes.find((node) => node.id === "run-acceptance-tests") as ProjectStep & { agentId: string }).agentId
  );
  return "enforced";
});

await runCase({
  case: "ALL-CONFIGURED-TRANSITIONS",
  loop_step: "20 agent Steps × 6 outcomes; 5 human Steps × 2 decisions",
  agent: "all agents and human gates",
  expected_outcome: "130/130 passed",
  artifacts: [".ballet/project.json", ".ballet/evals/fixtures/agent-outcomes.yaml"],
  approval_boundary: "Actual RuntimeDatabase transition must equal the project-configured action and retry limit.",
  gap: null
}, async () => {
  let count = 0;
  for (const loop of automation.loops) {
    for (const node of loop.nodes) {
      if (isProjectTerminalNode(node)) continue;
      for (const [signal, action] of getProjectStepTransitionEntries(node)) {
        await withRuntime(async (runtime, runtimeRoot) => {
          const { config, run } = startAt(runtime, runtimeRoot, loop.id, node.id, `input:${loop.id}:${node.id}:${signal}`);
          const initial = run.stepRuns[0]!;
          const completed = node.type === "human"
            ? runtime.respondToStepRun(config, defaultLoopTheme, run.runId, initial.stepRunId, signal as "approved" | "rejected", `human:${signal}`)
            : runtime.completeAgentStep(config, defaultLoopTheme, {
                stepRunId: initial.stepRunId,
                outcome: configuredOutcome(signal, action, `${loop.id}-${node.id}-${signal}`)
              });
          const persisted = completed.stepRuns.find((step) => step.stepRunId === initial.stepRunId)!;
          assertTransition(persisted, action, node.id);
          if (action.action === "wait") {
            const resumed = runtime.resumeStepRun(config, defaultLoopTheme, completed.runId, initial.stepRunId, "fixture-resume");
            const resumedSource = resumed.stepRuns.find((step) => step.stepRunId === initial.stepRunId)!;
            assert.equal(resumedSource.transition?.action, "wait");
            if (resumedSource.transition?.action === "wait") assert(resumedSource.transition.resumed);
          }
          if (action.action === "goto" && typeof action.target === "object") {
            const child = runtime.listRootLoopRuns(run.rootRunId).find((candidate) => candidate.parentStepRunId === initial.stepRunId);
            assert(child, "Cross-Loop goto did not create a child Run.");
            assert.equal(child.loopId, action.target.loop);
          }
        });
        count += 1;
      }
    }
  }
  assert.equal(count, 130);
  return `${count}/${count} passed`;
});

await runCase({
  case: "SOURCE-READINESS-HAPPY",
  loop_step: "blueprint-design / source-inventory → source-validation",
  agent: "roadmap-agent / source-contract-audit",
  expected_outcome: "ready",
  artifacts: ["mock source-plane", "mock Goal/ADR/DESIGN", "source-snapshot.yaml"],
  approval_boundary: "Only accepted, same-scope, hash-matching fixture sources may continue.",
  gap: null
}, async () => {
  const root = await materializeFixture("full-happy.yaml");
  const inventory = validator(SOURCE_VALIDATOR, root, ["--source-plane", ".ballet/source-plane.yaml", "--requirements", SOURCE_REQUIREMENTS]);
  assert.equal(inventory.outcome, "ready");
  const snapshot = validator(SOURCE_VALIDATOR, root, ["--snapshot", ".ballet/outputs/source-snapshot.yaml", "--source-plane", ".ballet/source-plane.yaml", "--requirements", SOURCE_REQUIREMENTS]);
  assert.equal(snapshot.outcome, "ready");
  return "ready";
});

await runCase({
  case: "CURRENT-SOURCE-READINESS",
  loop_step: "blueprint-design / source-validation",
  agent: "roadmap-agent / source-contract-audit",
  expected_outcome: "needs_input",
  artifacts: [".ballet/source-plane.yaml", ".ballet/goals/**", ".ballet/adr/**"],
  approval_boundary: "Missing same-scope DESIGN, stable acceptance IDs and quality thresholds require a human-owned source update.",
  gap: null
}, async () => validator(SOURCE_VALIDATOR, ROOT, ["--source-plane", ".ballet/source-plane.yaml", "--requirements", SOURCE_REQUIREMENTS]).outcome);

for (const sourceCase of [
  { id: "SOURCE-MISSING-DECISION", fixture: "source-missing.yaml" },
  { id: "SOURCE-CONFLICT", fixture: "source-conflict.yaml" }
]) {
  await runCase({
    case: sourceCase.id,
    loop_step: "blueprint-design / gap-and-conflict-audit → source-decision-gate",
    agent: "roadmap-agent / source-contract-audit + decision-request",
    expected_outcome: "needs_input",
    artifacts: [sourceCase.fixture, "specification-gaps.yaml", "decision-requests.yaml"],
    approval_boundary: "A gate response is not source authority; inventory must rerun after accepted source update.",
    gap: null
  }, async () => {
    const root = await materializeFixture(sourceCase.fixture);
    const result = validator(SOURCE_VALIDATOR, root, ["--source-plane", ".ballet/source-plane.yaml"]);
    assert.equal(result.outcome, "needs_input");
    await withRuntime(async (runtime, runtimeRoot) => {
      const { config, run } = startAt(runtime, runtimeRoot, "blueprint-design", "gap-and-conflict-audit");
      const completed = runtime.completeAgentStep(config, defaultLoopTheme, {
        stepRunId: run.stepRuns[0]!.stepRunId,
        outcome: agentOutcomeSchema.parse(fixtureOutcomes.needs_input)
      });
      assert.equal(completed.status, "waiting_for_human");
      assert.equal(activeStep(completed)?.stepId, "source-decision-gate");
    });
    return result.outcome;
  });
}

await runCase({
  case: "SKILL-DETERMINISTIC-VALIDATORS",
  loop_step: "blueprint-design + milestone-planning artifact Steps",
  agent: "all 9 configured skills",
  expected_outcome: "9 skills / 12 modes passed",
  artifacts: ["all fixture blueprint artifacts", "milestone manifest", "issue drafts"],
  approval_boundary: "Each persisted artifact is bound to canonical path, source snapshot, author and raw-byte inputs.",
  gap: null
}, async () => {
  const root = await materializeFixture("full-happy.yaml");
  const invocations: Array<[string, string[]]> = [
    [".agents/skills/source-contract-audit/scripts/validate.mjs", ["--snapshot", ".ballet/outputs/source-snapshot.yaml", "--source-plane", ".ballet/source-plane.yaml", "--requirements", SOURCE_REQUIREMENTS]],
    [".agents/skills/decision-request/scripts/validate.mjs", ["--gaps", ".ballet/evals/artifacts/specification-gaps-missing.yaml", "--requests", ".ballet/evals/artifacts/decision-requests-missing.yaml"]],
    [".agents/skills/vertical-slice-roadmap/scripts/validate.mjs", ["--file", ".ballet/outputs/roadmap.yaml"]],
    [".agents/skills/architecture-blueprint/scripts/validate.mjs", ["--kind", "domain_map", "--file", ".ballet/outputs/domain-map.yaml"]],
    [".agents/skills/architecture-blueprint/scripts/validate.mjs", ["--kind", "c4_context_container", "--file", ".ballet/outputs/c4-context-container.yaml"]],
    [".agents/skills/architecture-blueprint/scripts/validate.mjs", ["--kind", "quality_scenarios", "--file", ".ballet/outputs/quality-scenarios.yaml"]],
    [".agents/skills/architecture-blueprint/scripts/validate.mjs", ["--kind", "test_strategy", "--file", ".ballet/outputs/test-strategy.yaml"]],
    [".agents/skills/threat-model/scripts/validate.mjs", ["--file", ".ballet/outputs/threat-model.yaml"]],
    [".agents/skills/ui-flow-design/scripts/validate.mjs", ["--file", ".ballet/outputs/ux-information-architecture.yaml"]],
    [".agents/skills/traceability/scripts/validate.mjs", ["--file", ".ballet/outputs/traceability-manifest.yaml"]],
    [".agents/skills/independent-blueprint-review/scripts/validate.mjs", ["--review", ".ballet/outputs/blueprint-review.yaml", "--packet", ".ballet/outputs/blueprint-gate-packet.yaml"]],
    [".agents/skills/issue-slicing/scripts/validate.mjs", ["--handoff", ".ballet/evals/handoffs/blueprint-approved.yaml", "--manifest", ".ballet/outputs/milestones/milestone-001/milestone-manifest.yaml", "--issues", ".ballet/outputs/milestones/milestone-001/issue-drafts.yaml"]]
  ];
  let passed = 0;
  for (const [script, args] of invocations) {
    const result = validator(script, root, args);
    assert.equal(result.result, "passed", `${script}: ${JSON.stringify(result.issues)}`);
    passed += 1;
  }
  assert.equal(passed, 12);
  return "9 skills / 12 modes passed";
});

await runCase({
  case: "BLUEPRINT-HUMAN-APPROVAL",
  loop_step: "blueprint-design / independent-blueprint-verifier → blueprint-gate",
  agent: "blueprint-verifier-agent + human",
  expected_outcome: "milestone-planning started",
  artifacts: ["blueprint-review.yaml", "blueprint-gate-packet.yaml", "blueprint-approved handoff"],
  approval_boundary: "Only approved independent review with exact packet/source hashes reaches milestone planning.",
  gap: "GAP-APPROVAL-ASSERTION (runtime input remains opaque; downstream validator enforces the fixture claim)"
}, async () => {
  const fixtureRoot = await materializeFixture("full-happy.yaml");
  const gate = validator(".agents/skills/independent-blueprint-review/scripts/validate.mjs", fixtureRoot, ["--review", ".ballet/outputs/blueprint-review.yaml", "--packet", ".ballet/outputs/blueprint-gate-packet.yaml"]);
  assert.equal(gate.outcome, "approved");
  const handoff = readFileSync(path.join(fixtureRoot, ".ballet/evals/handoffs/blueprint-approved.yaml"), "utf8");
  return withRuntime(async (runtime, runtimeRoot) => {
    const { config, run } = startAt(runtime, runtimeRoot, "blueprint-design", "blueprint-gate");
    approveHuman(runtime, config, run, run.stepRuns[0]!, handoff);
    const child = runtime.listRootLoopRuns(run.rootRunId).find((candidate) => candidate.loopId === "milestone-planning");
    assert(child && child.status === "running");
    return "milestone-planning started";
  });
});

await runCase({
  case: "BLUEPRINT-VERIFIER-CHANGES-REQUESTED",
  loop_step: "blueprint-design / independent-blueprint-verifier",
  agent: "blueprint-verifier-agent",
  expected_outcome: "changes-requested; stale packet blocked",
  artifacts: ["blueprint-review.yaml", "absent-or-stale blueprint-gate-packet.yaml"],
  approval_boundary: "A non-approved review cannot emit or retain an approvable packet.",
  gap: null
}, async () => {
  const root = await materializeFixture("full-happy.yaml");
  const reviewPath = path.join(root, ".ballet/outputs/blueprint-review.yaml");
  const review = parseYaml(await readFile(reviewPath, "utf8"));
  review.verdict = "changes_requested";
  review.findings = [{ id: "fixture-finding", severity: "error" }];
  review.checks = [{ id: "traceability", status: "failed" }];
  await writeFile(reviewPath, stringifyYaml(review), "utf8");
  const clean = validator(".agents/skills/independent-blueprint-review/scripts/validate.mjs", root, ["--review", ".ballet/outputs/blueprint-review.yaml"]);
  assert.equal(clean.outcome, "changes-requested");
  const stale = validator(".agents/skills/independent-blueprint-review/scripts/validate.mjs", root, ["--review", ".ballet/outputs/blueprint-review.yaml", "--packet", ".ballet/outputs/blueprint-gate-packet.yaml"]);
  assert.equal(stale.outcome, "blocked");
  assert(stale.issues.some((entry) => entry.code === "stale_gate_packet"));
  return "changes-requested; stale packet blocked";
});

await runCase({
  case: "BLUEPRINT-HUMAN-REJECTION",
  loop_step: "blueprint-design / blueprint-gate → source-inventory",
  agent: "human + blueprint authors/checker",
  expected_outcome: "blocked after 3 repairs",
  artifacts: ["human rejection fixture outcomes"],
  approval_boundary: "Rejection never starts milestone planning and uses project.json maxAttempts=3.",
  gap: null
}, async () => withRuntime(async (runtime, runtimeRoot) => {
  const { config, rootRunId } = startAt(runtime, runtimeRoot, "blueprint-design", "blueprint-gate");
  for (let rejection = 1; rejection <= 4; rejection += 1) {
    const gate = driveToHuman(runtime, config, rootRunId);
    assert.equal(gate.step.stepId, "blueprint-gate");
    const response = rejectHuman(runtime, config, gate.run, gate.step, `rejection-${rejection}`);
    if (rejection <= 3) assert.equal(response.status, "running");
    else assert.equal(response.status, "blocked");
  }
  assert(!runtime.listRootLoopRuns(rootRunId).some((run) => run.loopId === "milestone-planning"));
  return "blocked after 3 repairs";
}));

await runCase({
  case: "MILESTONE-PLANNING-AND-ISSUE-GATE",
  loop_step: "milestone-planning / plan-milestone-issues → milestone-gate",
  agent: "milestone-issues-agent, implementation-plan-agent, test-plan-agent + human",
  expected_outcome: "milestone-delivery started",
  artifacts: ["milestone-manifest.yaml", "issue-drafts.yaml", "implementation-plan.yaml", "test-plan.yaml"],
  approval_boundary: "Issue drafts remain draft_only/not_executed through the human milestone gate.",
  gap: "No GitHub writer Step is configured; positive publication is intentionally unexpressed."
}, async () => {
  const fixtureRoot = await materializeFixture("full-happy.yaml");
  const sliced = validator(".agents/skills/issue-slicing/scripts/validate.mjs", fixtureRoot, ["--handoff", ".ballet/evals/handoffs/blueprint-approved.yaml", "--manifest", ".ballet/outputs/milestones/milestone-001/milestone-manifest.yaml", "--issues", ".ballet/outputs/milestones/milestone-001/issue-drafts.yaml"]);
  assert.equal(sliced.outcome, "ready");
  const planningApproval = validator(".agents/skills/_shared/scripts/validate-delivery-evidence.mjs", fixtureRoot, ["--phase", "planning", "--approval", ".ballet/evals/approvals/milestone-gate.yaml"]);
  assert.equal(planningApproval.outcome, "approved");
  return withRuntime(async (runtime, runtimeRoot) => {
    const rootRunId = seedRootRun(runtime, "milestone-planning", runtimeRoot);
    runtime.startLoopRun(automation, "milestone-planning", defaultLoopTheme, rootRunId, "valid blueprint handoff");
    const gate = driveToHuman(runtime, automation, rootRunId);
    assert.equal(gate.step.stepId, "milestone-gate");
    const approval = readFileSync(path.join(fixtureRoot, ".ballet/evals/approvals/milestone-gate.yaml"), "utf8");
    approveHuman(runtime, automation, gate.run, gate.step, approval);
    const child = runtime.listRootLoopRuns(rootRunId).find((run) => run.loopId === "milestone-delivery");
    assert(child);
    return "milestone-delivery started";
  });
});

await runCase({
  case: "IMPLEMENTATION-MAKER-CHECKER-STAGING",
  loop_step: "milestone-delivery / implement-milestone → run-acceptance-tests → implementation-gate",
  agent: "implementation-agent ≠ acceptance-test-agent + human",
  expected_outcome: "release-validation started",
  artifacts: ["acceptance-evidence.yaml", "staging-report.yaml", "implementation-gate claim"],
  approval_boundary: "No release child exists before exact staging/Git-SHA human approval.",
  gap: "GAP-APPROVAL-ASSERTION"
}, async () => {
  const fixtureRoot = await materializeFixture("full-happy.yaml");
  const evidence = validator(".agents/skills/_shared/scripts/validate-delivery-evidence.mjs", fixtureRoot, ["--phase", "staging", "--approval", ".ballet/evals/approvals/implementation-gate.yaml"]);
  assert.equal(evidence.outcome, "approved");
  return withRuntime(async (runtime, runtimeRoot) => {
    const rootRunId = seedRootRun(runtime, "milestone-delivery", runtimeRoot);
    runtime.startLoopRun(automation, "milestone-delivery", defaultLoopTheme, rootRunId, "approved milestone");
    const gate = driveToHuman(runtime, automation, rootRunId);
    assert.equal(gate.step.stepId, "implementation-gate");
    assert(!runtime.listRootLoopRuns(rootRunId).some((run) => run.loopId === "release-validation"));
    const approval = readFileSync(path.join(fixtureRoot, ".ballet/evals/approvals/implementation-gate.yaml"), "utf8");
    approveHuman(runtime, automation, gate.run, gate.step, approval);
    assert(runtime.listRootLoopRuns(rootRunId).some((run) => run.loopId === "release-validation"));
    return "release-validation started";
  });
});

await runCase({
  case: "CHANGES-REQUESTED-BOUNDED-REPAIR",
  loop_step: "milestone-delivery / run-acceptance-tests → implement-milestone",
  agent: "acceptance-test-agent → implementation-agent",
  expected_outcome: "blocked after 3 changed-evidence repairs",
  artifacts: ["four distinct failed acceptance fixture outcomes"],
  approval_boundary: "Only same-milestone repair is allowed; project.json maxAttempts=3 and same-evidence stall apply.",
  gap: null
}, async () => withRuntime(async (runtime, runtimeRoot) => {
  const { config, rootRunId } = startAt(runtime, runtimeRoot, "milestone-delivery", "run-acceptance-tests");
  for (let repair = 1; repair <= 4; repair += 1) {
    const run = activeRootRun(runtime, rootRunId)!;
    const checker = activeStep(run)!;
    assert.equal(checker.stepId, "run-acceptance-tests");
    const result = runtime.completeAgentStep(config, defaultLoopTheme, {
      stepRunId: checker.stepRunId,
      outcome: configuredOutcome("changes-requested", (config.loops.find((loop) => loop.id === "milestone-delivery")!.nodes.find((node) => node.id === "run-acceptance-tests") as ProjectStep).on["changes-requested"], String(repair))
    });
    if (repair <= 3) {
      assert.equal(result.status, "running");
      const maker = activeStep(result)!;
      assert.equal(maker.stepId, "implement-milestone");
      runtime.completeAgentStep(config, defaultLoopTheme, { stepRunId: maker.stepRunId, outcome: agentOutcomeSchema.parse(fixtureOutcomes.ready) });
    } else assert.equal(result.status, "blocked");
  }
  return "blocked after 3 changed-evidence repairs";
}));

await runCase({
  case: "CHANGES-REQUESTED-SAME-EVIDENCE",
  loop_step: "milestone-delivery / run-acceptance-tests",
  agent: "acceptance-test-agent",
  expected_outcome: "retry_stalled",
  artifacts: ["repeated acceptance evidence fingerprint"],
  approval_boundary: "Unchanged evidence cannot consume repeated repair cycles.",
  gap: null
}, async () => withRuntime(async (runtime, runtimeRoot) => {
  const { config, rootRunId } = startAt(runtime, runtimeRoot, "milestone-delivery", "run-acceptance-tests");
  const first = activeRootRun(runtime, rootRunId)!;
  const evidence = configuredOutcome("changes-requested", (config.loops.find((loop) => loop.id === "milestone-delivery")!.nodes.find((node) => node.id === "run-acceptance-tests") as ProjectStep).on["changes-requested"], "same");
  runtime.completeAgentStep(config, defaultLoopTheme, { stepRunId: activeStep(first)!.stepRunId, outcome: evidence });
  let active = activeRootRun(runtime, rootRunId)!;
  runtime.completeAgentStep(config, defaultLoopTheme, { stepRunId: activeStep(active)!.stepRunId, outcome: agentOutcomeSchema.parse(fixtureOutcomes.ready) });
  active = activeRootRun(runtime, rootRunId)!;
  const stalled = runtime.completeAgentStep(config, defaultLoopTheme, { stepRunId: activeStep(active)!.stepRunId, outcome: evidence });
  assert.equal(stalled.status, "blocked");
  assert.equal(stalled.termination?.code, "retry_stalled");
  return "retry_stalled";
}));

await runCase({
  case: "NEEDS-INPUT-WAIT-RESUME",
  loop_step: "milestone-planning / implementation-plan",
  agent: "implementation-plan-agent + human input",
  expected_outcome: "resumed same-step",
  artifacts: ["needs_input outcome", "resume input"],
  approval_boundary: "Resume appends input but does not skip the current Step or a later gate.",
  gap: null
}, async () => withRuntime(async (runtime, runtimeRoot) => {
  const { config, run } = startAt(runtime, runtimeRoot, "milestone-planning", "implementation-plan", "original");
  const waiting = runtime.completeAgentStep(config, defaultLoopTheme, { stepRunId: run.stepRuns[0]!.stepRunId, outcome: agentOutcomeSchema.parse(fixtureOutcomes.needs_input) });
  assert.equal(waiting.status, "waiting_for_human");
  const resumed = runtime.resumeStepRun(config, defaultLoopTheme, waiting.runId, run.stepRuns[0]!.stepRunId, "clarification");
  assert.equal(resumed.status, "running");
  assert.equal(activeStep(resumed)?.stepId, "implementation-plan");
  assert.match(activeStep(resumed)?.input ?? "", /clarification/);
  return "resumed same-step";
}));

await runCase({
  case: "BLOCKED-OUTCOME",
  loop_step: "release-validation / make-git-release",
  agent: "release-agent",
  expected_outcome: "blocked",
  artifacts: ["blocked fixture outcome", "empty external ledger"],
  approval_boundary: "A missing approval/contract blocks before deploy-release.",
  gap: "GAP-LOOP-ENTRY (manual downstream start is platform-permitted, so the agent guard must block it)"
}, async () => withRuntime(async (runtime, runtimeRoot) => {
  const { config, run } = startAt(runtime, runtimeRoot, "release-validation", "make-git-release");
  const blocked = runtime.completeAgentStep(config, defaultLoopTheme, { stepRunId: run.stepRuns[0]!.stepRunId, outcome: agentOutcomeSchema.parse(fixtureOutcomes.blocked) });
  assert.equal(blocked.status, "blocked");
  assert(!blocked.stepRuns.some((step) => step.stepId === "deploy-release"));
  return "blocked";
}));

await runCase({
  case: "FAILED-OUTCOME-RETRY",
  loop_step: "milestone-planning / implementation-plan",
  agent: "implementation-plan-agent",
  expected_outcome: "permanent failed; transient retried once",
  artifacts: ["failed-permanent outcome", "failed-transient outcome"],
  approval_boundary: "Only transient failure uses project.json maxAttempts=1.",
  gap: null
}, async () => {
  await withRuntime(async (runtime, runtimeRoot) => {
    const { config, run } = startAt(runtime, runtimeRoot, "milestone-planning", "implementation-plan");
    const failed = runtime.completeAgentStep(config, defaultLoopTheme, { stepRunId: run.stepRuns[0]!.stepRunId, outcome: agentOutcomeSchema.parse(fixtureOutcomes["failed-permanent"]) });
    assert.equal(failed.status, "failed");
    assert.equal(failed.termination?.code, "configured_termination");
  });
  await withRuntime(async (runtime, runtimeRoot) => {
    const { config, run } = startAt(runtime, runtimeRoot, "milestone-planning", "implementation-plan");
    const retried = runtime.completeAgentStep(config, defaultLoopTheme, { stepRunId: run.stepRuns[0]!.stepRunId, outcome: agentOutcomeSchema.parse(fixtureOutcomes["failed-transient"]) });
    assert.equal(retried.status, "running");
    const retryStep = activeStep(retried)!;
    const exhausted = runtime.completeAgentStep(config, defaultLoopTheme, { stepRunId: retryStep.stepRunId, outcome: agentOutcomeSchema.parse(fixtureOutcomes["failed-transient"]) });
    assert.equal(exhausted.status, "failed");
    assert.equal(exhausted.termination?.code, "retry_exhausted");
  });
  return "permanent failed; transient retried once";
});

await runCase({
  case: "STALE-APPROVAL-SHA",
  loop_step: "milestone-planning / plan-milestone-issues",
  agent: "milestone-issues-agent / issue-slicing",
  expected_outcome: "blocked",
  artifacts: ["mutated blueprint handoff SHA", "unchanged gate packet"],
  approval_boundary: "A stale packet SHA blocks before milestone artifacts can be trusted.",
  gap: "GAP-APPROVAL-ASSERTION (project validator catches it; core input is opaque)"
}, async () => {
  const root = await materializeFixture("full-happy.yaml");
  const handoffPath = path.join(root, ".ballet/evals/handoffs/blueprint-approved.yaml");
  const handoff = parseYaml(await readFile(handoffPath, "utf8"));
  handoff.blueprint_gate_packet_sha256 = "f".repeat(64);
  await writeFile(handoffPath, stringifyYaml(handoff), "utf8");
  const result = validator(".agents/skills/issue-slicing/scripts/validate.mjs", root, ["--handoff", ".ballet/evals/handoffs/blueprint-approved.yaml", "--manifest", ".ballet/outputs/milestones/milestone-001/milestone-manifest.yaml", "--issues", ".ballet/outputs/milestones/milestone-001/issue-drafts.yaml"]);
  assert.equal(result.outcome, "blocked");
  assert(result.issues.some((entry) => entry.code === "stale_blueprint_approval_sha"));
  await withRuntime(async (runtime, runtimeRoot) => {
    const { config, run } = startAt(runtime, runtimeRoot, "milestone-planning", "plan-milestone-issues");
    const blocked = runtime.completeAgentStep(config, defaultLoopTheme, { stepRunId: run.stepRuns[0]!.stepRunId, outcome: agentOutcomeSchema.parse(fixtureOutcomes.blocked) });
    assert.equal(blocked.status, "blocked");
  });
  return result.outcome;
});

await runCase({
  case: "DOCUMENTATION-DRIFT",
  loop_step: "blueprint-design / source-validation",
  agent: "roadmap-agent / source-contract-audit",
  expected_outcome: "blocked",
  artifacts: ["source-snapshot.yaml", "mutated Goal bytes"],
  approval_boundary: "Raw-byte drift invalidates the snapshot before downstream artifacts.",
  gap: null
}, async () => {
  const root = await materializeFixture("full-happy.yaml");
  const goal = path.join(root, ".ballet/goals/goal-001.md");
  await writeFile(goal, `${await readFile(goal, "utf8")}\nControlled drift.\n`, "utf8");
  const result = validator(SOURCE_VALIDATOR, root, ["--snapshot", ".ballet/outputs/source-snapshot.yaml", "--source-plane", ".ballet/source-plane.yaml", "--requirements", SOURCE_REQUIREMENTS]);
  assert.equal(result.outcome, "blocked");
  assert(result.issues.some((entry) => ["source_hash_drift", "snapshot_inventory_drift"].includes(entry.code)));
  return result.outcome;
});

await runCase({
  case: "STALE-IMPLEMENTATION-APPROVAL-SHA",
  loop_step: "release-validation / make-git-release",
  agent: "release-agent / delivery-evidence",
  expected_outcome: "blocked",
  artifacts: ["implementation-gate claim", "release-manifest with different Git SHA"],
  approval_boundary: "Release subject Git SHA must equal the exact human-approved staging SHA.",
  gap: "GAP-APPROVAL-ASSERTION (project validator enforces it after opaque handoff)"
}, async () => {
  const root = await materializeFixture("full-happy.yaml");
  const manifestPath = path.join(root, ".ballet/outputs/releases/v1.0.0/release-manifest.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  manifest.git_sha = "5".repeat(40);
  await writeFile(manifestPath, stringifyYaml(manifest), "utf8");
  const result = validator(".agents/skills/_shared/scripts/validate-delivery-evidence.mjs", root, ["--phase", "release", "--approval", ".ballet/evals/approvals/implementation-gate.yaml", "--manifest", ".ballet/outputs/releases/v1.0.0/release-manifest.yaml"]);
  assert.equal(result.outcome, "blocked");
  assert(result.issues.some((entry) => entry.code === "release_approval_subject_sha_mismatch"));
  return result.outcome;
});

await runCase({
  case: "RELEASE-WITHOUT-APPROVAL",
  loop_step: "release-validation / make-git-release",
  agent: "release-agent / delivery-evidence",
  expected_outcome: "blocked",
  artifacts: ["rejected implementation-gate claim", "release-manifest fixture"],
  approval_boundary: "No tag/deploy/write is simulated without approved implementation claim.",
  gap: "GAP-LOOP-ENTRY + GAP-APPROVAL-ASSERTION"
}, async () => {
  const root = await materializeFixture("full-happy.yaml");
  const approvalPath = path.join(root, ".ballet/evals/approvals/implementation-gate.yaml");
  const approval = parseYaml(await readFile(approvalPath, "utf8"));
  approval.decision = "rejected";
  await writeFile(approvalPath, stringifyYaml(approval), "utf8");
  const result = validator(".agents/skills/_shared/scripts/validate-delivery-evidence.mjs", root, ["--phase", "release", "--approval", ".ballet/evals/approvals/implementation-gate.yaml", "--manifest", ".ballet/outputs/releases/v1.0.0/release-manifest.yaml"]);
  assert.equal(result.outcome, "blocked");
  return result.outcome;
});

await runCase({
  case: "RELEASE-AFTER-APPROVAL",
  loop_step: "release-validation / make-git-release → deploy-release → verify-release → release-gate",
  agent: "release-agent + human",
  expected_outcome: "completed without external writes",
  artifacts: ["implementation-gate claim", "release/environment contracts", "rollback evidence", "release-manifest.yaml"],
  approval_boundary: "Fixture authorization is allowed, while every external action remains not_executed.",
  gap: "Provider-level conditional tool authorization is not machine-enforced by Ballet."
}, async () => {
  const fixtureRoot = await materializeFixture("full-happy.yaml");
  const validation = validator(".agents/skills/_shared/scripts/validate-delivery-evidence.mjs", fixtureRoot, ["--phase", "release", "--approval", ".ballet/evals/approvals/implementation-gate.yaml", "--manifest", ".ballet/outputs/releases/v1.0.0/release-manifest.yaml"]);
  assert.equal(validation.outcome, "approved");
  return withRuntime(async (runtime, runtimeRoot) => {
    const { config, rootRunId } = startAt(runtime, runtimeRoot, "release-validation", "make-git-release", "validated fixture approval");
    const gate = driveToHuman(runtime, config, rootRunId);
    assert.equal(gate.step.stepId, "release-gate");
    const completed = approveHuman(runtime, config, gate.run, gate.step, "accept mock evidence only");
    assert.equal(completed.status, "completed");
    return "completed without external writes";
  });
});

await runCase({
  case: "ROLLBACK-EVIDENCE-MISSING",
  loop_step: "release-validation / make-git-release",
  agent: "release-agent / delivery-evidence",
  expected_outcome: "blocked",
  artifacts: ["release-manifest without rollback evidence"],
  approval_boundary: "Rollback evidence is a precondition, not post-failure documentation.",
  gap: null
}, async () => {
  const root = await materializeFixture("full-happy.yaml");
  const manifestPath = path.join(root, ".ballet/outputs/releases/v1.0.0/release-manifest.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  delete manifest.rollback.evidence;
  await writeFile(manifestPath, stringifyYaml(manifest), "utf8");
  const result = validator(".agents/skills/_shared/scripts/validate-delivery-evidence.mjs", root, ["--phase", "release", "--approval", ".ballet/evals/approvals/implementation-gate.yaml", "--manifest", ".ballet/outputs/releases/v1.0.0/release-manifest.yaml"]);
  assert.equal(result.outcome, "blocked");
  assert(result.issues.some((entry) => entry.code === "invalid_file_reference" || entry.code === "rollback_not_ready" || entry.code === "missing_reference_path"));
  return result.outcome;
});

await runCase({
  case: "RELEASE-GATE-REJECTION",
  loop_step: "release-validation / release-gate → verify-release",
  agent: "human → release-agent checker",
  expected_outcome: "verify-only repair",
  artifacts: ["release verification fixture", "human rejection"],
  approval_boundary: "Rejection retries verification only and never creates another make/deploy Step.",
  gap: null
}, async () => withRuntime(async (runtime, runtimeRoot) => {
  const { config, rootRunId } = startAt(runtime, runtimeRoot, "release-validation", "make-git-release");
  const gate = driveToHuman(runtime, config, rootRunId);
  const rejected = rejectHuman(runtime, config, gate.run, gate.step, "verify again");
  assert.equal(rejected.status, "running");
  assert.equal(activeStep(rejected)?.stepId, "verify-release");
  assert.equal(rejected.stepRuns.filter((step) => step.stepId === "make-git-release").length, 1);
  assert.equal(rejected.stepRuns.filter((step) => step.stepId === "deploy-release").length, 1);
  return "verify-only repair";
}));

await runCase({
  case: "FULL-CROSS-LOOP-HAPPY-PATH",
  loop_step: "all 4 Loops / 20 normal agent Steps / 4 delivery gates",
  agent: "all 10 agents + human",
  expected_outcome: "completed",
  artifacts: ["complete full-happy fixture bundle"],
  approval_boundary: "Each cross-Loop child starts only after its configured human gate in this simulated path.",
  gap: "Manual downstream Loop start and typed approval enforcement remain documented generic gaps."
}, async () => withRuntime(async (runtime, runtimeRoot) => {
  const rootRunId = seedRootRun(runtime, "blueprint-design", runtimeRoot);
  runtime.startLoopRun(automation, "blueprint-design", defaultLoopTheme, rootRunId, "full happy path");
  const visited = new Set<string>();
  const blueprint = driveToHuman(runtime, automation, rootRunId, visited);
  assert.equal(blueprint.step.stepId, "blueprint-gate");
  approveHuman(runtime, automation, blueprint.run, blueprint.step, "approved blueprint fixture");
  const milestone = driveToHuman(runtime, automation, rootRunId, visited);
  assert.equal(milestone.step.stepId, "milestone-gate");
  approveHuman(runtime, automation, milestone.run, milestone.step, "approved milestone fixture");
  const implementation = driveToHuman(runtime, automation, rootRunId, visited);
  assert.equal(implementation.step.stepId, "implementation-gate");
  approveHuman(runtime, automation, implementation.run, implementation.step, "approved staging fixture");
  const release = driveToHuman(runtime, automation, rootRunId, visited);
  assert.equal(release.step.stepId, "release-gate");
  const completed = approveHuman(runtime, automation, release.run, release.step, "approved release fixture");
  assert.equal(completed.status, "completed");
  assert.equal(visited.size, 10);
  return "completed";
}));

const failed = records.filter((record) => record.result === "failed");
const result = {
  eval_contract_version: 1,
  head,
  summary: { total: records.length, passed: records.length - failed.length, failed: failed.length },
  records
};

if (writeResults) {
  const output = path.join(ROOT, ".ballet/evals/results.json");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
if (failed.length > 0) process.exitCode = 1;
