import { ApiRequestError } from "@/apiClient";
import { emptyEventStormingModel, eventStormingModelSchema, type EventStormingDocument, type EventStormingModelV1 } from "@shared/orchestration/eventStorming";
import { stormApi } from "./stormApi";

export type StormEdit = (draft: EventStormingModelV1) => void;
interface StoreState {
  value: EventStormingModelV1; baseline?: EventStormingDocument; latest?: EventStormingDocument;
  loading: boolean; saving: boolean; dirty: boolean; error?: string; conflict: boolean; canUndo: boolean; canRedo: boolean;
}
/** Serial single-writer queue. Revisions fence saves/refreshes from newer in-memory edits. */
export class StormDocumentStore {
  private state: StoreState = { value: emptyEventStormingModel(), loading: true, saving: false, dirty: false, conflict: false, canUndo: false, canRedo: false };
  private listeners = new Set<() => void>();
  private past: EventStormingModelV1[] = [];
  private future: EventStormingModelV1[] = [];
  private revision = 0;
  private requestSequence = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private active = true;
  locked = false;
  constructor(private readonly api = stormApi) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<StoreState>) {
    this.state = { ...this.state, ...patch, canUndo: this.past.length > 0, canRedo: this.future.length > 0 };
    this.listeners.forEach((listener) => listener());
  }
  activate() { this.active = true; }
  dispose() { this.active = false; clearTimeout(this.timer); this.requestSequence++; }
  async refresh(discard = false) {
    if (this.state.saving) return;
    const sequence = ++this.requestSequence; const revision = this.revision;
    try {
      const latest = await this.api.read();
      if (!this.active || sequence !== this.requestSequence || this.state.saving) return;
      const changed = latest.contentHash !== this.state.baseline?.contentHash;
      if ((this.state.dirty || revision !== this.revision) && !discard) {
        if (changed) { clearTimeout(this.timer); this.publish({ latest, conflict: true, error: "The repository file changed. Your local draft is preserved." }); }
        else if (this.state.conflict) this.publish({ latest, conflict: false }); // A lock/size rejection is not a changed-file conflict.
        return;
      }
      if (changed || discard || !this.state.baseline) {
        this.past = []; this.future = []; this.revision++;
        this.publish({ value: latest.value, baseline: latest, latest: undefined, dirty: false, error: undefined, conflict: false });
      }
      this.publish({ loading: false, error: undefined });
    } catch (error) { if (this.active && sequence === this.requestSequence) this.publish({ loading: false, error: String(error instanceof Error ? error.message : error) }); }
  }
  edit = (change: StormEdit, immediate = false) => {
    if (this.locked || !this.state.baseline || this.state.conflict) return;
    const value = structuredClone(this.state.value); change(value);
    if (JSON.stringify(value) === JSON.stringify(this.state.value)) return;
    const valid = eventStormingModelSchema.safeParse(value);
    this.past = [...this.past.slice(-99), this.state.value]; this.future = [];
    this.revision++; this.publish({ value, dirty: true, error: valid.success ? undefined : valid.error.issues[0].message });
    clearTimeout(this.timer);
    if (valid.success) this.schedule(immediate);
  };
  undo = () => this.travel(false);
  redo = () => this.travel(true);
  private travel(forward: boolean) {
    if (this.locked || this.state.conflict) return;
    const source = forward ? this.future : this.past; const value = source.pop(); if (!value) return;
    (forward ? this.past : this.future).push(this.state.value);
    this.revision++; this.publish({ value, dirty: true, error: undefined }); this.schedule(true);
  }
  private schedule(immediate: boolean) { clearTimeout(this.timer); this.timer = setTimeout(() => { void this.save(); }, immediate ? 0 : 600); }
  save = async () => {
    clearTimeout(this.timer);
    if (!this.active || this.locked || this.state.saving || this.state.conflict || !this.state.dirty || !this.state.baseline) return;
    const valid = eventStormingModelSchema.safeParse(this.state.value);
    if (!valid.success) { this.publish({ error: valid.error.issues[0].message }); return; }
    const revision = this.revision; const value = this.state.value; const expectedHash = this.state.baseline.contentHash;
    this.requestSequence++; this.publish({ saving: true, error: undefined });
    try {
      const baseline = await this.api.save(value, expectedHash);
      if (!this.active) return;
      this.publish({ baseline, saving: false, dirty: this.revision !== revision });
      if (this.state.dirty) this.schedule(true);
    } catch (error) {
      if (!this.active) return;
      this.publish({ saving: false, error: error instanceof Error ? error.message : String(error), conflict: error instanceof ApiRequestError && error.status === 409 });
      if (this.state.conflict) await this.refresh();
    }
  };
}
