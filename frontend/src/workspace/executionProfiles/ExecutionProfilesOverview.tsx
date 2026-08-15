import type { ExecutionProfile, LocalRuntime } from "@shared/api/workspace-contracts";
import { Cpu } from "lucide-react";
import { CollectionCardGrid, CollectionEntityCard, OperationalStatus, Panel } from "@/components/shared/workspace-ui";
import { executionProfileCreatePath, executionProfilePath } from "../routing";
import type { WorkspaceNavigation } from "../useWorkspaceNavigation";
import { executionProfileBlockingReason } from "./executionProfileOptions";

export function ExecutionProfilesOverview({ profiles, runtime, navigate }: {
  profiles: ExecutionProfile[];
  runtime: LocalRuntime;
  navigate: WorkspaceNavigation["navigate"];
}) {
  return (
    <Panel title="Execution profiles" icon={<Cpu />} contentClassName="p-0">
      <CollectionCardGrid label="Execution profiles" addLabel="Add execution profile" onAdd={() => navigate(executionProfileCreatePath())}>
        {profiles.map((profile) => {
          const blockingReason = executionProfileBlockingReason(profile, runtime);
          return (
            <CollectionEntityCard
              key={profile.id}
              icon={<Cpu />}
              title={profile.name}
              identifier={profile.id}
              status={<OperationalStatus compact label={blockingReason ? "Unavailable" : "Available"} tone={blockingReason ? "danger" : "healthy"} />}
              description={blockingReason}
              metadata={<><span>{profile.provider}</span><span>{profile.model}</span><span>{profile.reasoningEffort}</span><span>network {profile.networkAccess ? "on" : "off"}</span></>}
              openLabel={`Open execution profile ${profile.name}`}
              onOpen={() => navigate(executionProfilePath(profile.id))}
            />
          );
        })}
      </CollectionCardGrid>
    </Panel>
  );
}
