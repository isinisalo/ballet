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
          const enabled = skill.enabled ?? true;
          const metadataCount = Object.keys(skill.metadata ?? {}).length;
          return (
            <CollectionEntityCard
              key={skill.id}
              icon={<FileKey2 />}
              title={skill.name}
              identifier={skill.id}
              status={<OperationalStatus compact label={enabled ? "enabled" : "disabled"} tone={enabled ? "healthy" : "neutral"} />}
              description={skill.description}
              metadata={<span>{metadataCount} metadata {metadataCount === 1 ? "key" : "keys"}</span>}
              openLabel={`Open skill ${skill.name}`}
              onOpen={() => skill.relativePath && navigate(skillDocumentPath(skill.relativePath))}
            />
          );
        })}
      </CollectionCardGrid>
    </Panel>
  );
}
