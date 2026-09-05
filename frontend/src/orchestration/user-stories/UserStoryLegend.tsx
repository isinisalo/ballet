import { STORY_PARTS } from "./userStoryPresentation";

export function UserStoryLegend() {
  return <ul aria-label="User Story color legend" className="story-legend">
    {STORY_PARTS.map(({ key, label }) => <li key={key}><span aria-hidden="true" className={`story-swatch story-highlight-${key}`} /><span>{label}</span></li>)}
  </ul>;
}
