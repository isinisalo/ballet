import { request } from "@/apiClient";
import type { UserStoryCollection, UserStoryDocument, UserStoryInput } from "@shared/orchestration/userStories";

const base = "/api/user-stories";
export const userStoryApi = {
  list: () => request<UserStoryCollection>(base),
  save: (value: UserStoryInput, current?: UserStoryDocument) => request<UserStoryDocument>(
    current ? `${base}/${encodeURIComponent(current.value.id)}` : base,
    { method: current ? "PUT" : "POST", body: JSON.stringify(current ? { value, expectedHash: current.contentHash } : value) }
  ),
  remove: (current: UserStoryDocument) => request<void>(`${base}/${encodeURIComponent(current.value.id)}`, {
    method: "DELETE", body: JSON.stringify({ expectedHash: current.contentHash })
  })
};
