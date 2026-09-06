import { useStormContext } from "../event-storming/useStormContext";
import { stormPath } from "../event-storming/stormPresentation";
import { BookOpenText, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { USER_STORY_LIMITS, type UserStoryCollection } from "@shared/orchestration/userStories";
import { ConfigureToolbar } from "../configure/ConfigureToolbar";
import { UserStoryCard } from "./UserStoryCard";
import { UserStoryLegend } from "./UserStoryLegend";

export function UserStoryList({ data, locked, canCreate, notice, onCreate, onEdit }: {
  data: UserStoryCollection; locked: boolean; canCreate: boolean; notice: string; onCreate(): void; onEdit(id: string): void;
}) {
  const count = data.stories.length;
  const context = useStormContext();
  return <>
    <ConfigureToolbar status={locked ? "Locked by active Run" : `${count} ${count === 1 ? "story" : "stories"}`}>
      <Button size="sm" disabled={!canCreate} onClick={onCreate}><Plus aria-hidden="true" />New user story</Button>
    </ConfigureToolbar>
    <div className="story-workspace-content"><UserStoryLegend /><p role="status" className="sr-only">{notice}</p>
      {count + data.issues.length >= USER_STORY_LIMITS.stories ? <p className="mb-4 text-sm text-muted-foreground">Maximum {USER_STORY_LIMITS.stories} stories reached. Remove a story before creating another.</p> : null}
      {context.error && <p role="alert">Process backlinks unavailable: {context.error}</p>}
      {data.issues.map((issue) => <Alert key={issue.id} variant="destructive" className="mb-4"><AlertDescription>
        <strong>Invalid User Story file</strong><code className="block break-all text-xs">.ballet/user-stories/{issue.id}.md</code>{issue.message}
      </AlertDescription></Alert>)}
      {!count && !data.issues.length ? <section className="story-empty">
        <BookOpenText aria-hidden="true" className="mb-4 size-8 text-primary" /><h2 className="mb-2 text-lg font-medium">Start with a person and a purpose.</h2>
        <p className="max-w-md text-sm text-muted-foreground">Write your first User Story, then add the examples that make success clear.</p>
        <Button className="mt-5" disabled={!canCreate} onClick={onCreate}><Plus aria-hidden="true" />New user story</Button>
      </section> : <div className="space-y-4">{data.stories.map(({ value }) => <div key={value.id}><UserStoryCard value={value} onEdit={() => onEdit(value.id)} /><nav aria-label={`Processes for story ${value.id}`} className="flex flex-wrap gap-3 px-5">{context.data?.kind === "index" && context.data.stories.find((s) => s.id === value.id)?.links.map((link) => <a className="inline-flex min-h-10 items-center text-primary underline" key={link.processId} href={stormPath(link.processId, undefined, undefined, value.id)}>{link.title || link.processId}{link.stepIds.length ? ` · ${link.stepIds.length} steps` : ""}</a>)}</nav></div>)}</div>}
    </div>
  </>;
}
