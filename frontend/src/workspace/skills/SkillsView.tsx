import type { Skill } from "@shared/api/workspace-contracts";
import type { WorkspaceNavigation } from "../useWorkspaceNavigation";
import { SkillEditor } from "./SkillEditor";
import { SkillsOverview } from "./SkillsOverview";

export function SkillsView({
  skills = [],
  skill,
  creating = false,
  save,
  remove,
  navigate,
  setNavigationBlocker
}: {
  skills?: Skill[];
  skill?: Skill;
  creating?: boolean;
  save: (collection: "skills", item: Partial<Skill>) => Promise<Skill>;
  remove: (collection: "skills", id: string) => Promise<void>;
  navigate: WorkspaceNavigation["navigate"];
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  if (!skill && !creating) return <SkillsOverview skills={skills} navigate={navigate} />;
  return <SkillEditor skill={skill} save={save} remove={remove} navigate={navigate} setNavigationBlocker={setNavigationBlocker} />;
}
