import type Database from "better-sqlite3";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CreateEnvironmentRunInput } from "../../../shared/orchestration/persistence.js";
import { sha256 } from "../../../shared/orchestration/primitives.js";
import { isAllowedCanonicalRefinementPath } from "../../../shared/orchestration/refinement.js";
import { ReviewCoordinator } from "../persistence/ReviewCoordinator.js";
import { ReviewStore } from "../persistence/ReviewStore.js";
import { ConflictError } from "../persistence/PersistenceErrors.js";
import { runGit } from "../../execution/git/gitProcess.js";

export type RefinementValidationId = "instruction_contract" | "resource_contract" | "relevant_tests";

export interface RefinementValidationRunner {
  run(id: RefinementValidationId, worktreePath: string): Promise<void>;
}

export interface ContinuationFactoryInput {
  refinementProposalId: string;
  refinementApplyId: string;
  commitSha: string;
}

export type ContinuationFactory = (
  input: ContinuationFactoryInput
) => Promise<CreateEnvironmentRunInput & { continuationLinkId: string; continuationSnapshotHash: string }>;

export class RefinementApplyService {
  private readonly reviews: ReviewStore;
  private readonly coordinator: ReviewCoordinator;

  constructor(
    private readonly connection: () => Database.Database,
    private readonly projectRoot: string,
    private readonly worktreesRoot: string,
    private readonly validations: RefinementValidationRunner,
    private readonly continuation: ContinuationFactory,
    private readonly now: () => string,
    private readonly allowedPath: (relativePath: string) => boolean = isAllowedCanonicalRefinementPath
  ) {
    this.reviews = new ReviewStore(connection);
    this.coordinator = new ReviewCoordinator(connection);
  }

  async apply(refinementProposalId: string, refinementApplyId: string): Promise<"applied" | "stale" | "apply_failed"> {
    const proposal = this.reviews.requireRefinementProposal(refinementProposalId);
    if (proposal.status !== "applying") throw new Error("Refinement Proposal is not human-approved for apply.");
    const files = this.reviews.refinementFiles(refinementProposalId);
    const branch = `ballet/refinement/${safeId(refinementProposalId)}`;
    const worktreePath = path.join(this.worktreesRoot, safeId(refinementApplyId));
    const at = this.now();
    const observed: Record<string, string> = {};
    this.connection().transaction(() => {
      this.reviews.assertRefinementApplyAuthorized(refinementProposalId);
      const existing = this.connection().prepare(
        "SELECT status FROM refinement_applies WHERE refinement_proposal_id = ?"
      ).get(refinementProposalId);
      if (existing) throw new ConflictError("Refinement Proposal already has an apply operation.");
      this.connection().prepare(`
        INSERT INTO refinement_applies (
          refinement_apply_id, refinement_proposal_id, status, worktree_path, branch, created_at
        ) VALUES (?, ?, 'running', ?, ?, ?)
      `).run(refinementApplyId, refinementProposalId, worktreePath, branch, at);
    })();
    try {
      await git(this.projectRoot, ["cat-file", "-e", `${String(proposal.expected_base_commit)}^{commit}`]);
      await mkdir(this.worktreesRoot, { recursive: true, mode: 0o700 });
      await git(this.projectRoot, ["worktree", "add", "-b", branch, worktreePath, String(proposal.expected_base_commit)]);
      for (const file of files) {
        const relativePath = String(file.relative_path);
        assertSafePath(relativePath, this.allowedPath);
        const absolutePath = path.join(worktreePath, relativePath);
        await assertNoSymlinkChain(worktreePath, relativePath);
        const existing = await readFile(absolutePath).catch((error) => {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
          throw error;
        });
        observed[relativePath] = existing ? sha256(existing.toString("utf8")) : "absent";
      }
      const stale = files.some((file) => observed[String(file.relative_path)] !== file.expected_preimage_hash);
      if (stale) {
        return this.coordinator.recordApply({
          refinementApplyId, refinementProposalId, status: "applied", worktreePath, branch,
          observedPreimageHashes: observed, completedAt: at
        });
      }
      for (const file of files) await applyFile(worktreePath, file);
      for (const file of files) await assertResultHash(worktreePath, file);
      const plan = JSON.parse(String(proposal.validation_plan_json)) as RefinementValidationId[];
      for (const id of plan) {
        if (!["instruction_contract", "resource_contract", "relevant_tests"].includes(id)) {
          throw new Error(`Refinement validation ${String(id)} is not allowlisted.`);
        }
        await this.validations.run(id, worktreePath);
      }
      await git(worktreePath, ["add", "-A"]);
      await git(worktreePath, [
        "-c", "user.name=Ballet", "-c", "user.email=ballet@localhost", "commit",
        "-m", `chore(refinement): apply ${safeId(refinementProposalId)}`,
        "-m", `Ballet-Refinement-Proposal: ${refinementProposalId}\nBallet-Change-List-Hash: ${String(proposal.change_list_hash)}`
      ]);
      const commitSha = await git(worktreePath, ["rev-parse", "HEAD"]);
      const continuation = await this.continuation({ refinementProposalId, refinementApplyId, commitSha });
      return this.coordinator.recordApply({
        refinementApplyId, refinementProposalId, status: "applied", worktreePath, branch, commitSha,
        observedPreimageHashes: observed, completedAt: at, continuation
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.coordinator.recordApply({
        refinementApplyId, refinementProposalId, status: "apply_failed", worktreePath, branch,
        errorMessage: message, observedPreimageHashes: observed, completedAt: at
      });
      return "apply_failed";
    }
  }
}

const applyFile = async (root: string, file: Record<string, unknown>): Promise<void> => {
  const target = path.join(root, String(file.relative_path));
  const operation = String(file.operation);
  if (operation === "delete") { await rm(target); return; }
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, String(file.proposed_content), { encoding: "utf8", flag: operation === "create" ? "wx" : "w" });
};
const assertResultHash = async (root: string, file: Record<string, unknown>): Promise<void> => {
  const expected = String(file.proposed_content_hash);
  const bytes = await readFile(path.join(root, String(file.relative_path))).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  });
  const observed = bytes ? sha256(bytes.toString("utf8")) : "absent";
  if (observed !== expected) throw new Error(`Result hash differs for ${String(file.relative_path)}.`);
};
const assertSafePath = (relativePath: string, allowedPath: (path: string) => boolean): void => {
  if (!allowedPath(relativePath) || /(^|\/)(?:\.env|secrets?|credentials?)(?:\.|\/|$)/i.test(relativePath)) {
    throw new Error(`Unsafe Refinement path ${relativePath}.`);
  }
};
const assertNoSymlinkChain = async (root: string, relativePath: string): Promise<void> => {
  let current = root;
  for (const part of relativePath.split("/")) {
    current = path.join(current, part);
    const metadata = await lstat(current).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    });
    if (metadata?.isSymbolicLink()) throw new Error(`Refinement path crosses symlink ${relativePath}.`);
  }
};
const git = async (cwd: string, args: string[]): Promise<string> => {
  const result = await runGit(args, { cwd });
  return result.stdout.trim();
};
const safeId = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
