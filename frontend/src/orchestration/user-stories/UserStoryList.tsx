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
  return <>
    <ConfigureToolbar status={locked ? "Locked by active Run" : `${count} ${count === 1 ? "story" : "stories"}`}>
      <Button size="sm" disabled={!canCreate} onClick={onCreate}><Plus aria-hidden="true" />New user story</Button>
    </ConfigureToolbar>
    <div className="story-workspace-content"><UserStoryLegend /><p role="status" className="sr-only">{notice}</p>
      {count + data.issues.length >= USER_STORY_LIMITS.stories ? <p className="mb-4 text-sm text-muted-foreground">Maximum {USER_STORY_LIMITS.stories} stories reached. Remove a story before creating another.</p> : null}
      {data.issues.map((issue) => <Alert key={issue.id} variant="destructive" className="mb-4"><AlertDescription>
        <strong>Invalid User Story file</strong><code className="block break-all text-xs">.ballet/user-stories/{issue.id}.md</code>{issue.message}
      </AlertDescription></Alert>)}
      {!count && !data.issues.length ? <section className="story-empty">
        <BookOpenText aria-hidden="true" className="mb-4 size-8 text-primary" /><h2 className="mb-2 text-lg font-medium">Start with a person and a purpose.</h2>
        <p className="max-w-md text-sm text-muted-foreground">Write your first User Story, then add the examples that make success clear.</p>
        <Button className="mt-5" disabled={!canCreate} onClick={onCreate}><Plus aria-hidden="true" />New user story</Button>
      </section> : <div className="space-y-4">{data.stories.map(({ value }) => <UserStoryCard key={value.id} value={value} onEdit={() => onEdit(value.id)} />)}</div>}
    </div>
  </>;
}
