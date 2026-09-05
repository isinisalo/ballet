import { useEffect, useRef, useState } from "react";
import type { RouteState } from "@/workspace/types";
import type { WorkspaceNavigation } from "@/workspace/useWorkspaceNavigation";
import { USER_STORY_LIMITS, type UserStoryDocument } from "@shared/orchestration/userStories";
import { useUserStories } from "./useUserStories";

export const USER_STORIES_PATH = "/project/user-stories";
export function useUserStoryWorkspace(route: RouteState, locked: boolean, navigate: WorkspaceNavigation["navigate"]) {
  const collection = useUserStories();
  const [focusId, setFocusId] = useState<string>();
  const [notice, setNotice] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const remembered = useRef<UserStoryDocument>();
  const selected = collection.data?.stories.find(({ value }) => value.id === route.entityId);
  if (remembered.current?.value.id !== route.entityId || selected) remembered.current = selected;
  const creating = route.createMode === "story";
  const editing = creating || Boolean(route.entityId);
  const routeKey = `${route.entityId ?? "list"}:${creating}`;
  const canCreate = !locked && !collection.error && (collection.data?.stories.length ?? 0) + (collection.data?.issues.length ?? 0) < USER_STORY_LIMITS.stories;
  useEffect(() => {
    if (collection.loading) return;
    const heading = container.current?.querySelector("h1");
    if (heading) { heading.tabIndex = -1; heading.focus(); }
  }, [routeKey, collection.loading]);
  useEffect(() => {
    if (editing || !focusId) return;
    const card = document.getElementById(`story-${focusId}`);
    if (card) { card.focus(); card.scrollIntoView({ block: "nearest" }); setFocusId(undefined); }
  }, [editing, focusId, collection.data]);
  const onSaved = (document: UserStoryDocument) => {
    collection.acceptSaved(document); setFocusId(document.value.id); setNotice("User story saved.");
    navigate(USER_STORIES_PATH, { bypassBlocker: true });
  };
  const onRemoved = (id: string) => {
    collection.acceptRemoved(id); setNotice("User story deleted."); navigate(USER_STORIES_PATH, { bypassBlocker: true });
  };
  return { collection, container, routeKey, selected, current: selected ?? remembered.current, creating, editing, canCreate, notice, onSaved, onRemoved };
}
