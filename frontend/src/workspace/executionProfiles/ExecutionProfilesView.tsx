import type { ExecutionProfile, ExecutionProfileSaveRequest, LocalRuntime } from "@shared/api/workspace-contracts";
import { executionProfilePath } from "../routing";
import type { WorkspaceNavigation } from "../useWorkspaceNavigation";
import { ExecutionProfileEditor } from "./ExecutionProfileEditor";
import { ExecutionProfilesOverview } from "./ExecutionProfilesOverview";

export function ExecutionProfilesView({ profiles, selectedProfile, creating = false, runtime, create, update, remove, navigate, setNavigationBlocker }: {
  profiles: ExecutionProfile[];
  selectedProfile?: ExecutionProfile;
  creating?: boolean;
  runtime: LocalRuntime;
  create: (id: string, request: ExecutionProfileSaveRequest) => Promise<ExecutionProfile>;
  update: (id: string, request: ExecutionProfileSaveRequest) => Promise<ExecutionProfile>;
  remove: (id: string) => Promise<void>;
  navigate: WorkspaceNavigation["navigate"];
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  if (!selectedProfile && !creating) return <ExecutionProfilesOverview profiles={profiles} runtime={runtime} navigate={navigate} />;
  return (
    <ExecutionProfileEditor
      profile={selectedProfile}
      existingProfileIds={profiles.map((profile) => profile.id)}
      runtime={runtime}
      create={create}
      update={update}
      remove={remove}
      onSaved={(saved) => navigate(executionProfilePath(saved.id), { bypassBlocker: true })}
      onDeleted={() => navigate(executionProfilePath(), { bypassBlocker: true })}
      setNavigationBlocker={setNavigationBlocker}
    />
  );
}
