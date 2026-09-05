import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { sha256 } from "../../../shared/orchestration/primitives.js";
import { isAllowedRefinementPath } from "../../../shared/orchestration/refinement.js";
import { ConflictError } from "../persistence/PersistenceErrors.js";

const execute = promisify(execFile);
type File = Record<string, unknown>;

/** Only immutable, hash-verified bytes may be presented as an exact preimage. */
export async function refinementPreimages(root: string, commit: string, resources: Array<{ relativePath: string; content: string }>, files: File[]) {
  if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(commit)) throw new ConflictError("Invalid Refinement base commit.");
  return Promise.all(files.map(async (file) => {
    const relativePath = String(file.relative_path);
    if (!isAllowedRefinementPath(relativePath)) throw new ConflictError("Refinement path is outside the allowed scope.");
    if (file.operation === "create") return { ...file, preimage_content: null };
    let content = resources.find((resource) => resource.relativePath === relativePath && sha256(resource.content) === file.expected_preimage_hash)?.content;
    if (content === undefined) {
      try {
        const result = await execute("git", ["-c", "core.hooksPath=/dev/null", "show", `${commit}:${relativePath}`], {
          cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }
        });
        content = result.stdout;
      } catch { throw new ConflictError(`Exact preimage is unavailable for ${relativePath}.`); }
    }
    if (sha256(content) !== file.expected_preimage_hash) throw new ConflictError(`Exact preimage hash differs for ${relativePath}.`);
    return { ...file, preimage_content: content };
  }));
}
