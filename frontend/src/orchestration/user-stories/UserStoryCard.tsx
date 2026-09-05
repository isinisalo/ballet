import { ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AcceptanceCriterion, UserStoryV1 } from "@shared/orchestration/userStories";
import { CRITERION_PARTS, shortStoryId, STORY_PARTS } from "./userStoryPresentation";

export function UserStoryCard({ value, onEdit }: { value: UserStoryV1; onEdit(): void }) {
  return <article id={`story-${value.id}`} tabIndex={-1} aria-labelledby={`story-title-${value.id}`} className="story-article">
    <Card className="story-card"><CardContent className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={`story-title-${value.id}`} className="font-mono text-xs text-muted-foreground"><span className="sr-only">User story </span>{shortStoryId(value.id)}</h2>
        <Button size="sm" variant="ghost" aria-label={`Edit user story ${shortStoryId(value.id)}`} onClick={onEdit}>Edit<ArrowUpRight aria-hidden="true" /></Button>
      </div>
      <p className="story-sentence">{STORY_PARTS.map(({ key, label, prefix }, index) => <span key={key}>
        {index ? " " : ""}{prefix}{" "}<mark className={`story-highlight-${key}`}><span className="sr-only">{label}: </span>{value[key]}</mark>{index === 0 ? "," : index === 2 ? "." : ""}
      </span>)}</p>
      <AcceptanceCriteria criteria={value.acceptanceCriteria} />
    </CardContent></Card>
  </article>;
}

function AcceptanceCriteria({ criteria }: { criteria: AcceptanceCriterion[] }) {
  return <section className="story-criteria" aria-label="Acceptance criteria">
    <h3 className="story-section-label">Acceptance criteria <span aria-hidden="true">·</span> {criteria.length}</h3>
    {criteria.length ? <ol className="story-scenarios">{criteria.map((criterion, index) => <li key={index}>
      <span className="story-scenario-number"><span className="sr-only">Criterion </span>{String(index + 1).padStart(2, "0")}</span>
      <dl className="story-gwt">{CRITERION_PARTS.map((part) => <div key={part}><dt>{part.toUpperCase()}</dt><dd>{criterion[part]}</dd></div>)}</dl>
    </li>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">No acceptance criteria yet.</p>}
  </section>;
}
