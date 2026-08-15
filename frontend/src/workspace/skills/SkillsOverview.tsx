import type { Skill } from "@shared/api/workspace-contracts";
import { FileKey2 } from "lucide-react";
import { CollectionCardGrid, CollectionEntityCard, OperationalStatus, Panel } from "@/components/shared/workspace-ui";
import { skillCreatePath, skillDocumentPath } from "../routing";
import type { WorkspaceNavigation } from "../useWorkspaceNavigation";

export function SkillsOverview({ skills, navigate }: {
  skills: Skill[];
  navigate: WorkspaceNavigation["navigate"];
}) {
  return (
    <Panel title="Skills" icon={<FileKey2 />} contentClassName="p-0">
      <CollectionCardGrid label="Skills" addLabel="Add skill" onAdd={() => navigate(skillCreatePath())}>
        {skills.map((skill) => {
          return (
            <CollectionEntityCard
              key={skill.id}
              icon={<FileKey2 />}
              title={skill.name}
              identifier={skill.id}
              status={<OperationalStatus compact label={skill.valid ? "Valid" : "Invalid"} tone={skill.valid ? "healthy" : "danger"} />}
              description={skill.description}
              metadata={<><span className="min-w-0 truncate" title={skill.relativePath}>path: {skill.relativePath ?? "Unknown"}</span><span>project ID: {skill.id}</span></>}
              openLabel={`Open skill ${skill.name}`}
              onOpen={() => skill.relativePath && navigate(skillDocumentPath(skill.relativePath))}
            />
          );
        })}
      </CollectionCardGrid>
    </Panel>
  );
}
