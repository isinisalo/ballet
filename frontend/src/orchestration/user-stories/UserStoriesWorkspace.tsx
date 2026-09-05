import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { RouteState } from "@/workspace/types";
import type { WorkspaceNavigation } from "@/workspace/useWorkspaceNavigation";
import { orchestrationEntityPath } from "@/workspace/routing";
import { ConfigureHeader } from "../configure/ConfigureHeader";
import { UserStoryEditor } from "./UserStoryEditor";
import { UserStoryList } from "./UserStoryList";
import { USER_STORIES_PATH, useUserStoryWorkspace } from "./useUserStoryWorkspace";
import "./userStories.css";

export function UserStoriesWorkspace({ route, locked, navigate, onDirty }: {
  route: RouteState; locked: boolean; navigate: WorkspaceNavigation["navigate"]; onDirty(dirty: boolean): void;
}) {
  const workspace = useUserStoryWorkspace(route, locked, navigate);
  const { collection, creating, editing, selected, current } = workspace;
  const back = () => navigate(USER_STORIES_PATH);
  const title = creating ? "New user story" : editing ? "Edit user story" : "User Story";
  const unavailable = Boolean(collection.error) || (!creating && !selected);
  let content;
  if (collection.loading) content = <p role="status" className="p-6 text-sm text-muted-foreground">Loading User Stories…</p>;
  else if (editing && (creating || current)) content = <UserStoryEditor key={workspace.routeKey} current={current} locked={locked} unavailable={unavailable}
    onDirty={onDirty} onBack={back} onRefresh={collection.refresh} onSaved={workspace.onSaved} onRemoved={workspace.onRemoved} />;
  else if (collection.data && !editing) content = <UserStoryList data={collection.data} locked={locked} canCreate={workspace.canCreate} notice={workspace.notice}
    onCreate={() => navigate(`${USER_STORIES_PATH}?create=story`)} onEdit={(id) => navigate(orchestrationEntityPath(USER_STORIES_PATH, id))} />;
  return <div ref={workspace.container} className="user-stories-workspace">
    <ConfigureHeader eyebrow="Project" title={title} description={editing ? "Describe who needs something, what they need, and why it matters." : "Who needs it. What they need. Why it matters."} />
    {collection.error ? <Alert variant="destructive" className="m-4"><AlertDescription>{collection.error}<Button variant="outline" size="sm" className="mt-2" onClick={() => void collection.refresh()}>Try again</Button></AlertDescription></Alert> : null}
    {content}
    {!collection.loading && route.entityId && !selected ? <Alert className="m-4"><AlertDescription>This story is missing or its file is invalid. Return to the list to review file errors. Any edits are preserved until you leave this view.
      <Button size="sm" variant="outline" className="mt-2" onClick={back}>Back to stories</Button>
    </AlertDescription></Alert> : null}
  </div>;
}
