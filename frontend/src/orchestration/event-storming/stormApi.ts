import { request } from "@/apiClient";
import type { EventStormingDocument, EventStormingModelV1 } from "@shared/orchestration/eventStorming";
export const stormApi = {
  read: () => request<EventStormingDocument>("/api/event-storming"),
  save: (value: EventStormingModelV1, expectedHash: string) => request<EventStormingDocument>("/api/event-storming", {
    method: "PUT", body: JSON.stringify({ value, expectedHash })
  })
};
