import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { USER_STORY_LIMITS } from "@shared/orchestration/userStories";
import { CONTRACT_LIMITS } from "@shared/orchestration/limits";
import { STORY_PARTS, CRITERION_PARTS } from "./userStoryPresentation";
import type { useUserStoryDraft } from "./useUserStoryDraft";

export function UserStoryFields({ editor, disabled }: { editor: ReturnType<typeof useUserStoryDraft>; disabled: boolean }) {
  const { draft, setDraft, errors, dirty, criterionKeys } = editor;
  return <fieldset disabled={disabled} className="min-w-0 space-y-6">
    <legend className="sr-only">User Story and acceptance criteria</legend>
    <div className="space-y-4">{STORY_PARTS.map(({ key, label, prefix, placeholder }) => <div key={key} className={`story-field story-field-${key}`}>
      <Label htmlFor={`story-${key}`}><span className={`story-field-label story-highlight-${key}`}>{label}</span>{" "}<span className="story-field-prefix">{prefix}</span></Label>
      <div className="min-w-0"><Textarea className="resize-y" id={`story-${key}`} required maxLength={CONTRACT_LIMITS.text} placeholder={placeholder} value={draft[key]}
        aria-invalid={dirty && Boolean(errors[key])} aria-describedby={dirty && errors[key] ? `story-${key}-error` : undefined}
        onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
        {dirty && errors[key] ? <p id={`story-${key}-error`} className="mt-1 text-sm text-destructive">{errors[key]}</p> : null}
      </div>
    </div>)}</div>
    <section className="story-criteria" aria-label="Acceptance criteria editor">
      <h2 className="story-section-label">Acceptance criteria <span aria-hidden="true">·</span> {draft.acceptanceCriteria.length}</h2>
      {draft.acceptanceCriteria.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Add concrete examples of what success looks like.</p> : null}
      <ol className="story-scenarios">{draft.acceptanceCriteria.map((criterion, index) => <li key={criterionKeys[index]}>
        <span className="story-scenario-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <fieldset className="min-w-0 flex-1"><legend className="sr-only">Acceptance criterion {index + 1}</legend>
          <div className="story-gwt story-gwt-editor">{CRITERION_PARTS.map((part) => {
            const id = `criterion-${criterionKeys[index]}-${part}`; const error = errors[`acceptanceCriteria.${index}.${part}`];
            return <div key={part}><Label htmlFor={id}>{part.toUpperCase()}{" "}<span className="sr-only">for criterion {index + 1}</span></Label>
              <div className="min-w-0"><Textarea className="resize-y" id={id} required maxLength={CONTRACT_LIMITS.text} value={criterion[part]} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
                onChange={(event) => setDraft({ ...draft, acceptanceCriteria: draft.acceptanceCriteria.map((item, position) => position === index ? { ...item, [part]: event.target.value } : item) })} />
                {error ? <p id={`${id}-error`} className="mt-1 text-sm text-destructive">{error}</p> : null}
              </div></div>;
          })}</div>
          <Button type="button" size="sm" variant="ghost" className="mt-2" aria-label={`Remove criterion ${index + 1}`} onClick={() => editor.removeCriterion(index)}><Trash2 aria-hidden="true" />Remove criterion</Button>
        </fieldset>
      </li>)}</ol>
      <Button id="add-criterion" type="button" variant="outline" size="sm" className="mt-4" disabled={draft.acceptanceCriteria.length >= USER_STORY_LIMITS.criteria} onClick={editor.addCriterion}>Add acceptance criterion</Button>
      {draft.acceptanceCriteria.length >= USER_STORY_LIMITS.criteria ? <p className="mt-2 text-sm text-muted-foreground">Maximum {USER_STORY_LIMITS.criteria} criteria reached.</p> : null}
    </section>
  </fieldset>;
}
