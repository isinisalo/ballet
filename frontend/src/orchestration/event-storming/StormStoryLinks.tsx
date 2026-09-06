import { Button } from "@/components/ui/button";
import type { UserStoryCollection } from "@shared/orchestration/userStories";
import { UserStoryCard } from "../user-stories/UserStoryCard";
export function StormStoryLinks({ ids, collection, locked, change, open, inherited = false }: {
  inherited?: boolean; ids: string[]; collection?: UserStoryCollection; locked: boolean; change(ids: string[]): void; open(id: string): void;
}) {
  return <section className="storm-story-links"><h3>{inherited ? "Process User Stories" : "Linked User Stories"}</h3>
    {!inherited && <label>Link a story<select aria-label="Link a story" value="" disabled={locked || !collection} onChange={(e) => { if (e.target.value) change([...ids, e.target.value]); }}>
      <option value="">Choose a story…</option>{collection?.stories.filter((s) => !ids.includes(s.value.id)).map(({ value: s }) => <option key={s.id} value={s.id}>{s.role} — {s.goal} ({s.status})</option>)}
    </select></label>}
    {!ids.length && <p>No stories linked. You can save this process now.</p>}
    {ids.map((id) => {
      const document = collection?.stories.find((s) => s.value.id === id);
      return <div key={id}>{!inherited && <Button variant="outline" disabled={locked} onClick={() => change(ids.filter((v) => v !== id))}>Unlink {id.slice(0, 8)}</Button>}
        {document ? <>
          <UserStoryCard value={document.value} onEdit={() => open(id)} />
        </> : <p role="alert">Story {id} is missing or invalid. {collection?.issues.find((i) => i.id === id)?.message}</p>}
      </div>;
    })}
  </section>;
}
