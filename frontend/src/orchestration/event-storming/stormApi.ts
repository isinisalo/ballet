import { request } from "@/apiClient";
import type { EventStormingDocument, EventStormingModelV2 } from "@shared/orchestration/eventStorming";
import type { EventStormingLayoutDocument, EventStormingLayoutV1 } from "@shared/orchestration/eventStormingLayout";
import type { StormContext, StormContextQuery } from "@shared/orchestration/eventStormingContext";
export const stormApi = {
  read: () => request<EventStormingDocument>("/api/event-storming"),
  save: (value: EventStormingModelV2, expectedHash: string) => request<EventStormingDocument>("/api/event-storming", { method: "PUT", body: JSON.stringify({ value, expectedHash }) }),
  readLayout: () => request<EventStormingLayoutDocument>("/api/event-storming/layout"),
  saveLayout: (value: EventStormingLayoutV1, expectedHash: string) => request<EventStormingLayoutDocument>("/api/event-storming/layout", { method: "PUT", body: JSON.stringify({ value, expectedHash }) }),
  context: (query: StormContextQuery = {}) => request<StormContext>(`/api/event-storming/context?${new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])))}`)
};
