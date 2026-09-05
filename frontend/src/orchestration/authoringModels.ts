export const skillImpactWarning = (skillId: string, entries: Array<{ kind: string; id: string; references: unknown[] }>) => {
  const count = entries.find((entry) => entry.kind === "skill" && entry.id === skillId)?.references.length ?? 0;
  return count > 0 ? `Shared Skill impacts ${count} referencing role${count === 1 ? "" : "s"}.` : "No current Action references.";
};
