import { emptyEventStormingModel, eventStormingModelSchema, type EventStormingModelV2 } from "@shared/orchestration/eventStorming";
import { emptyEventStormingLayout, eventStormingLayoutSchema, type EventStormingLayoutV1 } from "@shared/orchestration/eventStormingLayout";
import { StormFileStore } from "./StormFileStore";
import { stormApi } from "./stormApi";
export interface StormDraft { model: EventStormingModelV2; layout: EventStormingLayoutV1 }
export type StormEdit = (draft: StormDraft) => void;
type Entry = { before: Partial<StormDraft>; after: Partial<StormDraft> };
export class StormDocumentStore {
  readonly model: StormFileStore<EventStormingModelV2>;
  readonly layout: StormFileStore<EventStormingLayoutV1>;
  private layoutDependsOnModel = false;
  private past: Entry[] = [];
  private future: Entry[] = [];
  private listeners = new Set<() => void>();
  private snapshot!: ReturnType<StormDocumentStore["snapshotValue"]>;
  constructor(api = stormApi) {
    const validate = <T>(schema: { safeParse(v: T): { success: boolean; error?: { issues: Array<{ message: string }> } } }) => (v: T) => schema.safeParse(v).error?.issues[0]?.message;
    this.model = new StormFileStore(emptyEventStormingModel(), api, validate(eventStormingModelSchema), () => { this.publish(); if (this.layout && !this.model.state.dirty && !this.model.state.saving && this.layout.state.dirty && !this.layout.state.error) queueMicrotask(() => { void this.layout.save(); }); }, () => this.clearHistory("model"));
    this.layout = new StormFileStore(emptyEventStormingLayout(), { read: api.readLayout, save: api.saveLayout }, validate(eventStormingLayoutSchema), () => this.publish(), () => this.clearHistory("layout"), () => this.layoutDependsOnModel && (this.model.state.dirty || this.model.state.saving));
    this.publish();
  }
  private snapshotValue() { return { model: this.model.state, layout: this.layout.state, canUndo: this.past.length > 0, canRedo: this.future.length > 0 }; }
  private publish() {
    if (!this.model || !this.layout) return;
    this.snapshot = this.snapshotValue(); this.listeners.forEach((f) => f());
  }
  private clearHistory(file: keyof StormDraft) {
    this.past = this.past.filter((entry) => !entry.before[file]); this.future = this.future.filter((entry) => !entry.before[file]);
  }
  set locked(value: boolean) { this.model.locked = value; this.layout.locked = value; }
  getSnapshot = () => this.snapshot;
  subscribe = (f: () => void) => { this.listeners.add(f); return () => { this.listeners.delete(f); }; };
  activate() { this.model.active = true; this.layout.active = true; }
  dispose() { this.model.dispose(); this.layout.dispose(); }
  refresh = async () => { await Promise.all([this.model.refresh(), this.layout.refresh()]); };
  save = async () => { await this.model.save(); await this.layout.save(); };
  edit = (change: StormEdit, immediate = false) => {
    const before: StormDraft = { model: this.model.state.value, layout: this.layout.state.value };
    const after = structuredClone(before); change(after);
    const entry: Entry = { before: {}, after: {} };
    for (const key of ["model", "layout"] as const) {
      const file = this[key];
      if (JSON.stringify(before[key]) === JSON.stringify(after[key]) || file.locked || file.state.conflict || !file.state.baseline) continue;
      Object.assign(entry.before, { [key]: before[key] }); Object.assign(entry.after, { [key]: after[key] });
    }
    if (!Object.keys(entry.before).length) return;
    this.past = [...this.past.slice(-99), entry]; this.future = [];
    this.apply(entry.after, immediate); this.publish();
  };
  private apply(value: Partial<StormDraft>, immediate: boolean) {
    if (value.model && value.layout) this.layoutDependsOnModel = true;
    else if (!this.model.state.dirty && !this.model.state.saving) this.layoutDependsOnModel = false;
    if (value.model) this.model.set(value.model, immediate);
    if (value.layout) this.layout.set(value.layout, immediate);
  }
  undo = () => this.travel(false);
  redo = () => this.travel(true);
  private travel(forward: boolean) {
    const source = forward ? this.future : this.past; const entry = source.at(-1); if (!entry) return;
    if ((["model", "layout"] as const).some((key) => entry.before[key] && (this[key].locked || this[key].state.conflict))) return;
    source.pop(); (forward ? this.past : this.future).push(entry);
    this.apply(forward ? entry.after : entry.before, true); this.publish();
  }
}
