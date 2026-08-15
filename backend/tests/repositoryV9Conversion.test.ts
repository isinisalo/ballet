import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ProjectConfiguration } from "../../shared/domain/projectConfig.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const projectPath = path.join(repositoryRoot, ".ballet", "project.json");
const instructionsPath = path.join(repositoryRoot, ".ballet", "instructions");
const legacyAgentsPath = path.join(repositoryRoot, ".codex", "agents");

// Frozen from the pre-v9 tracked project. The projection contains, in order,
// every Loop/start/node ID, type, description, transition, schedule, and appearance field.
const BASELINE_LOOP_ORDER_SHA256 = "dbf2e931a90e7922eb8c38a15efba54cec27081b9026c4161bb6b7753c1878c0";
const BASELINE_LOOP_IDENTITY_SHA256 = "db14cff7f0bad8f82019bfdcd4ce58ddc2d416ac97765b70ed518fd210257f3e";
const BASELINE_WORKFLOW_PROJECTION_SHA256 = "053cadcd3e0ac22c727db1d4ddbc0f6ddb02d568784604dc3debe53f3769467b";
const EXPECTED_PROJECT_FILE_SHA256 = "3df5e6eaf5e088fe7bdf359c99b6157883c2355113cbad712836cc1dc6b32321";

const EXPECTED_PROFILE_TUPLES = [
  [
    "codex-gpt-5-6-luna-medium-network-off",
    "Codex GPT-5.6 Luna · Medium · Network off",
    "codex",
    "gpt-5.6-luna",
    "medium",
    false
  ],
  [
    "codex-gpt-5-6-luna-medium-network-on",
    "Codex GPT-5.6 Luna · Medium · Network on",
    "codex",
    "gpt-5.6-luna",
    "medium",
    true
  ],
  [
    "codex-gpt-5-6-sol-medium-network-off",
    "Codex GPT-5.6 Sol · Medium · Network off",
    "codex",
    "gpt-5.6-sol",
    "medium",
    false
  ],
  [
    "codex-gpt-5-6-terra-medium-network-off",
    "Codex GPT-5.6 Terra · Medium · Network off",
    "codex",
    "gpt-5.6-terra",
    "medium",
    false
  ],
  [
    "codex-gpt-5-6-terra-medium-network-on",
    "Codex GPT-5.6 Terra · Medium · Network on",
    "codex",
    "gpt-5.6-terra",
    "medium",
    true
  ]
] as const;

const EXPECTED_STEP_COMPOSITIONS = [
  ["roadmap", "codex-gpt-5-6-sol-medium-network-off", "project:roadmap-agent", []],
  ["data-model", "codex-gpt-5-6-sol-medium-network-off", "project:architecture-agent", []],
  ["ui-design", "codex-gpt-5-6-sol-medium-network-off", "project:ui-design-agent", []],
  ["ui-mocks", "codex-gpt-5-6-sol-medium-network-off", "project:ui-design-agent", []],
  ["c4-models", "codex-gpt-5-6-sol-medium-network-off", "project:architecture-agent", []],
  ["plan-milestone-issues", "codex-gpt-5-6-luna-medium-network-on", "project:milestone-issues-agent", []],
  ["implementation-plan", "codex-gpt-5-6-luna-medium-network-off", "project:implementation-plan-agent", []],
  ["test-plan", "codex-gpt-5-6-luna-medium-network-off", "project:test-plan-agent", []],
  ["implement-milestone", "codex-gpt-5-6-terra-medium-network-off", "project:implementation-agent", []],
  ["review-implementation", "codex-gpt-5-6-terra-medium-network-on", "project:acceptance-test-agent", []],
  ["make-git-release", "codex-gpt-5-6-terra-medium-network-on", "project:release-agent", []],
  ["deploy-release", "codex-gpt-5-6-terra-medium-network-on", "project:release-agent", []],
  ["verify-release", "codex-gpt-5-6-terra-medium-network-on", "project:release-agent", []]
] as const;

// Body sizes and hashes come from the decoded v8 TOML developer_instructions values.
const EXPECTED_MIGRATED_INSTRUCTIONS = [
  {
    file: "migrated-acceptance-test-agent.md",
    id: "acceptance-test-agent",
    title: "Acceptance Test Agent",
    bodyBytes: 1122,
    bodySha256: "7cfd792f7babc545e0c87e9e245c487e72a33b50fb8812e2d7d4db9855618691",
    fileBytes: 1185,
    fileSha256: "385e84d38d3e47eb6f59c592fa97412789532be923be3ea6fac43c981ed52c91"
  },
  {
    file: "migrated-architecture-agent.md",
    id: "architecture-agent",
    title: "Architecture Agent",
    bodyBytes: 1044,
    bodySha256: "81d5e907bb49d23362636204cc7f1af7cc5c5b2ca675de6001f4c72b4320b157",
    fileBytes: 1101,
    fileSha256: "11899b0c22a437798be42a18ff884aced2f702aa217ad8d7a84521c275c4ba07"
  },
  {
    file: "migrated-implementation-agent.md",
    id: "implementation-agent",
    title: "Implementation Agent",
    bodyBytes: 1141,
    bodySha256: "a1b004866cca23b3b0f9331e30580e46ec43b577a269a7d725c95b93dc104822",
    fileBytes: 1202,
    fileSha256: "d4566b637c521e8c96d4ac1a905441793207749d2b9accf858d0fae416eae204"
  },
  {
    file: "migrated-implementation-plan-agent.md",
    id: "implementation-plan-agent",
    title: "Implementation Plan Agent",
    bodyBytes: 1041,
    bodySha256: "7f80bd382dd5227e2f182aaae44f3d4455b86d097c4cf7e6ee5aa6a04d3db013",
    fileBytes: 1112,
    fileSha256: "d618ef2586c96d3cca084193714ad1f0b268cffaafcbc57655e7b7071da2865c"
  },
  {
    file: "migrated-milestone-issues-agent.md",
    id: "milestone-issues-agent",
    title: "Milestone Issues Agent",
    bodyBytes: 1242,
    bodySha256: "01ad7c323348c355144158e85ff8c5d75f3dfe0a75b28d88bbbe44a45b280325",
    fileBytes: 1307,
    fileSha256: "a34949be8e2e2f88ed7585c5dd0f0808b952588644034e4957a70478c289cb0b"
  },
  {
    file: "migrated-release-agent.md",
    id: "release-agent",
    title: "Release Agent",
    bodyBytes: 1574,
    bodySha256: "c32cece9e659825ae1bd9ed72f75ccd43f6df4f30ed9b62a31bc6b1731e292cd",
    fileBytes: 1621,
    fileSha256: "c2be3de18cd4419f385aef572793df32edcfb032ffab93f517a15744d0698306"
  },
  {
    file: "migrated-roadmap-agent.md",
    id: "roadmap-agent",
    title: "Roadmap Agent",
    bodyBytes: 1338,
    bodySha256: "36f67f037517db73adca3a022ffa1e332895c68f1aba851963277afe31f8a777",
    fileBytes: 1385,
    fileSha256: "7df3f73363fc02d00931465012c6427d5d23e0d70a127207b6b48c9a902d4c85"
  },
  {
    file: "migrated-test-plan-agent.md",
    id: "test-plan-agent",
    title: "Test Plan Agent",
    bodyBytes: 924,
    bodySha256: "36d9a0c769b09055220c257075acac88b49c11cc5484d7f7aad31f0a7e53182c",
    fileBytes: 975,
    fileSha256: "2fb67c3bc74d452dd508c06f9c7bb75789568301c853a2fac021c552be6359fc"
  },
  {
    file: "migrated-ui-design-agent.md",
    id: "ui-design-agent",
    title: "UI Design Agent",
    bodyBytes: 1024,
    bodySha256: "4ee1faf039d64bdc1da6942c4ba22115bf6a47dc0363b0390f43440c49f0ff23",
    fileBytes: 1075,
    fileSha256: "f89b78b3d1164282cfe006344dd1b5e9bd8c1a3a8190d5abcf6412ceb16247a1"
  }
] as const;

describe("tracked repository v9 conversion", () => {
  it("preserves the v8 workflow while deterministically replacing Agents with composition resources", async () => {
    const projectSource = await readFile(projectPath, "utf8");
    const project = JSON.parse(projectSource) as ProjectConfiguration & Record<string, unknown>;
    const loopOrder = project.loops.map((loop) => loop.id);
    const loopIdentity = project.loops.map((loop) => [
      loop.id,
      loop.start,
      loop.nodes.map((node) => node.id)
    ]);
    const workflowProjection = project.loops.map((loop) => [
      loop.id,
      loop.start,
      loop.nodes.map((node) => [
        node.id,
        node.type,
        node.description,
        "on" in node ? node.on.approved : null,
        "on" in node ? node.on.rejected : null,
        "schedule" in node ? node.schedule : null,
        node.nodeStyle,
        node.nodeSize
      ])
    ]);

    expect(project.version).toBe(9);
    expect(Object.keys(project)).toEqual(["version", "executionProfiles", "loops"]);
    expect("agents" in project).toBe(false);
    expect(JSON.stringify(project)).not.toContain('"agentId"');
    expect(sha256(JSON.stringify(loopOrder))).toBe(BASELINE_LOOP_ORDER_SHA256);
    expect(sha256(JSON.stringify(loopIdentity))).toBe(BASELINE_LOOP_IDENTITY_SHA256);
    expect(sha256(JSON.stringify(workflowProjection))).toBe(BASELINE_WORKFLOW_PROJECTION_SHA256);
    expect(sha256(projectSource)).toBe(EXPECTED_PROJECT_FILE_SHA256);

    const profiles = project.executionProfiles.map((profile) => [
      profile.id,
      profile.name,
      profile.provider,
      profile.model,
      profile.reasoningEffort,
      profile.networkAccess
    ]);
    const runtimeTuples = profiles.map(([, , provider, model, reasoning, network]) =>
      JSON.stringify([provider, model, reasoning, network]));
    expect(profiles).toEqual(EXPECTED_PROFILE_TUPLES);
    expect(new Set(runtimeTuples).size).toBe(5);
    const profileIds = project.executionProfiles.map((profile) => profile.id);
    expect(profileIds).toEqual([...profileIds].sort());

    const compositions = project.loops.flatMap((loop) => loop.nodes
      .filter((node) => node.type === "agent" || node.type === "scheduled")
      .map((node) => [node.id, node.executionProfileId, node.primaryInstructionId, node.skillIds]));
    expect(compositions).toEqual(EXPECTED_STEP_COMPOSITIONS);
    expect(compositions).toHaveLength(13);

    const instructionFiles = (await readdir(instructionsPath))
      .filter((file) => file.startsWith("migrated-") && file.endsWith(".md"))
      .sort();
    const instructions = await Promise.all(instructionFiles.map(async (file) => {
      const content = await readFile(path.join(instructionsPath, file), "utf8");
      const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/u.exec(content);
      expect(match, `${file} must have a frontmatter-delimited body`).not.toBeNull();
      const frontmatter = match?.[1] ?? "";
      const body = match?.[2] ?? "";
      return {
        file,
        id: /^id: (.+)$/mu.exec(frontmatter)?.[1],
        title: /^title: (.+)$/mu.exec(frontmatter)?.[1],
        bodyBytes: Buffer.byteLength(body),
        bodySha256: sha256(body),
        fileBytes: Buffer.byteLength(content),
        fileSha256: sha256(content)
      };
    }));
    expect(instructions).toEqual(EXPECTED_MIGRATED_INSTRUCTIONS);
    expect(new Set(compositions.map(([, , primary]) => primary.slice("project:".length))))
      .toEqual(new Set(instructions.map((instruction) => instruction.id)));
    expect(await entriesOrEmpty(legacyAgentsPath)).toEqual([]);
  });
});

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

const entriesOrEmpty = async (directory: string): Promise<string[]> => {
  try {
    return await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
};
