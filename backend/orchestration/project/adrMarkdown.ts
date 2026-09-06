import { parseAdr } from "../../../shared/orchestration/adr.js";
import { ConflictError } from "../persistence/PersistenceErrors.js";

export function validateAdrMarkdown(content: string, id: string): void {
  try { parseAdr(content, id); }
  catch (error) { throw new ConflictError(error instanceof Error ? error.message : "Virheellinen ADR."); }
}
