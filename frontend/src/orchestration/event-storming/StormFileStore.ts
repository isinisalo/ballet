import { ApiRequestError } from "@/apiClient";
export interface StormFileDocument<T> { value: T; contentHash: string }
export interface StormFileState<T> {
  value: T; baseline?: StormFileDocument<T>; latest?: StormFileDocument<T>;
  loading: boolean; saving: boolean; dirty: boolean; error?: string; conflict: boolean;
}
/** One optimistic queue per file; request and edit revisions fence late responses. */
export class StormFileStore<T> {
  state: StormFileState<T>;
  locked = false;
  active = true;
  private revision = 0;
  private sequence = 0;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(empty: T, private readonly api: { read(): Promise<StormFileDocument<T>>; save(value: T, hash: string): Promise<StormFileDocument<T>> },
    private readonly validate: (value: T) => string | undefined, private readonly notify: () => void,
    private readonly external: () => void, private readonly deferred: () => boolean = () => false) {
    this.state = { value: empty, loading: true, saving: false, dirty: false, conflict: false };
  }
  private publish(patch: Partial<StormFileState<T>>) { this.state = { ...this.state, ...patch }; this.notify(); }
  dispose() { this.active = false; clearTimeout(this.timer); this.sequence++; }
  async refresh(discard = false) {
    if (this.state.saving) return;
    const sequence = ++this.sequence, revision = this.revision;
    try {
      const latest = await this.api.read();
      if (!this.active || sequence !== this.sequence || this.state.saving) return;
      const changed = latest.contentHash !== this.state.baseline?.contentHash;
      if ((this.state.dirty || revision !== this.revision) && !discard) {
        if (changed) { clearTimeout(this.timer); this.publish({ latest, conflict: true, error: "Repository file changed. Local draft preserved." }); }
        else if (this.state.conflict) this.publish({ latest, conflict: false });
        return;
      }
      if (changed || discard || !this.state.baseline) {
        this.external(); this.revision++;
        this.publish({ value: latest.value, baseline: latest, latest: undefined, dirty: false, conflict: false });
      }
      this.publish({ loading: false, error: undefined });
    } catch (error) { if (this.active && sequence === this.sequence) this.publish({ loading: false, error: error instanceof Error ? error.message : String(error) }); }
  }
  set(value: T, immediate = false) {
    if (this.locked || this.state.conflict || !this.state.baseline) return;
    if (JSON.stringify(value) === JSON.stringify(this.state.value)) return;
    this.revision++; this.publish({ value, dirty: true, error: this.validate(value) });
    clearTimeout(this.timer);
    if (!this.state.error) this.timer = setTimeout(() => { void this.save(); }, immediate ? 0 : 600);
  }
  async save() {
    clearTimeout(this.timer);
    if (!this.active || this.locked || this.state.saving || this.state.conflict || !this.state.dirty || !this.state.baseline || this.deferred()) return;
    const error = this.validate(this.state.value);
    if (error) { this.publish({ error }); return; }
    const revision = this.revision, value = this.state.value, hash = this.state.baseline.contentHash;
    this.sequence++; this.publish({ saving: true, error: undefined });
    try {
      const baseline = await this.api.save(value, hash);
      if (!this.active) return;
      this.publish({ baseline, saving: false, dirty: revision !== this.revision });
      if (this.state.dirty) this.timer = setTimeout(() => { void this.save(); }, 0);
    } catch (error) {
      if (!this.active) return;
      this.publish({ saving: false, error: error instanceof Error ? error.message : String(error), conflict: error instanceof ApiRequestError && error.status === 409 });
      if (this.state.conflict) await this.refresh();
    }
  }
}
