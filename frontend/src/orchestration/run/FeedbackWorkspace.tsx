import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { JsonRow } from "../runTypes";
import { parseJson } from "../runModels";
import { ConfigureHeader } from "../configure/ConfigureHeader";
import { StatusLabel } from "./StatusLabel";

const categories = ["system", "architecture", "code", "design", "documentation"] as const;

export function FeedbackWorkspace({ rows, selected, selectedId, navigate, onCreate, onDecision, onRefinement }: {
  rows: JsonRow[]; selected?: JsonRow; selectedId?: string; navigate(path: string): void;
  onCreate(input: { category: typeof categories[number]; comment: string }): Promise<void>;
  onDecision(id: string, from: "open" | "in_refinement", decision: "resolved" | "dismissed"): Promise<void>;
  onRefinement(runId: string, feedbackId: string): Promise<void>;
}) {
  const [filter, setFilter] = useState("all"); const [creating, setCreating] = useState(false);
  if (selected) return <FeedbackDetail row={selected} navigate={navigate} onDecision={onDecision} onRefinement={onRefinement} />;
  if (selectedId) return <MissingDetail navigate={navigate} />;
  const visible = rows.filter((row) => filter === "all" || row.status === filter);
  return <><ConfigureHeader eyebrow="Run" title="Feedback" description="Add a category and a concise comment. Ballet binds trusted actor, commit and runtime provenance on the server; Refinement determines the exact resource correction." status={`${visible.length} entries`} actions={<Button onClick={() => setCreating((value) => !value)}>{creating ? "Close" : "Add Feedback"}</Button>} />
    <div className="space-y-4 p-4 md:p-6">{creating ? <HumanFeedbackForm onCreate={async (input) => { await onCreate(input); setCreating(false); }} /> : null}<label className="grid max-w-64 gap-1 text-sm">Status filter<select className="h-10 rounded-sm border bg-background px-2" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All</option><option value="open">Open</option><option value="in_refinement">In refinement</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></label><ul className="grid gap-3 lg:grid-cols-2">{visible.map((row) => <li key={String(row.feedback_entry_id)}><button className="min-h-32 w-full rounded-md border bg-card p-4 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" onClick={() => navigate(`/feedback/${encodeURIComponent(String(row.feedback_entry_id))}`)}><span className="flex flex-wrap items-center justify-between gap-2"><code className="text-tertiary">{String(row.feedback_entry_id)}</code><StatusLabel status={String(row.status)} /></span><strong className="mt-2 block capitalize">{String(row.category)}</strong><p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{String(row.comment)}</p><div className="mt-2 font-mono text-xs">{String(row.source)}</div></button></li>)}</ul></div>
  </>;
}

function HumanFeedbackForm({ onCreate }: { onCreate(input: { category: typeof categories[number]; comment: string }): Promise<void> }) {
  const [category, setCategory] = useState<typeof categories[number]>("code"); const [comment, setComment] = useState("");
  return <form className="grid max-w-2xl gap-3 rounded-md border bg-card p-4" onSubmit={(event) => { event.preventDefault(); void onCreate({ category, comment: comment.trim() }); }}><strong>Human Feedback</strong><Label>Category<select aria-label="Feedback category" className="mt-1 h-10 w-full rounded-sm border bg-background px-2" value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></Label><Label>Comment<textarea aria-label="Feedback comment" className="mt-1 min-h-32 w-full rounded-sm border bg-background p-3" value={comment} onChange={(event) => setComment(event.target.value)} /></Label><Button type="submit" className="w-fit" disabled={!comment.trim()}>Create Feedback</Button></form>;
}

function FeedbackDetail({ row, navigate, onDecision, onRefinement }: { row: JsonRow; navigate(path: string): void; onDecision(id: string, from: "open" | "in_refinement", decision: "resolved" | "dismissed"): Promise<void>; onRefinement(runId: string, feedbackId: string): Promise<void> }) {
  const id = String(row.feedback_entry_id); const status = String(row.status) as "open" | "in_refinement"; const runId = typeof row.environment_run_id === "string" ? row.environment_run_id : undefined;
  return <><ConfigureHeader eyebrow="Feedback" title={String(row.category)} description={String(row.comment)} status={String(row.status)} actions={<Button variant="outline" onClick={() => navigate("/feedback")}>All Feedback</Button>} /><div className="space-y-4 p-4 md:p-6"><section className="grid gap-2 rounded-md border bg-card p-4 text-sm sm:grid-cols-2"><span>ID <code>{id}</code></span><span>Source <code>{String(row.source)}</code></span><span>Category {String(row.category)}</span><span>Run <code>{runId ?? "project-level"}</code></span><span>Created by <code>{String(row.created_by ?? "runtime")}</code></span><span>Created {String(row.created_at)}</span></section><section className="rounded-md border bg-card p-4"><h2 className="font-semibold">Comment</h2><p className="mt-2 whitespace-pre-wrap text-sm">{String(row.comment)}</p></section>{status === "in_refinement" ? <p className="rounded-sm border border-tertiary/50 bg-tertiary/10 p-3 text-sm">Feedback is resolved only after verified continuation evidence.</p> : null}<details className="rounded-md border p-4"><summary>Technical provenance</summary><pre className="mt-2 max-w-full overflow-auto font-mono text-xs">{JSON.stringify(parseJson(row.provenance_json), null, 2)}</pre></details><div className="flex flex-wrap gap-2">{status === "open" ? <>{runId ? <Button onClick={() => void onRefinement(runId, id)}>Start Refinement proposal</Button> : null}<Button variant="outline" onClick={() => void onDecision(id, status, "resolved")}>Resolve</Button><Button variant="destructive" onClick={() => void onDecision(id, status, "dismissed")}>Dismiss</Button></> : null}</div></div></>;
}

const MissingDetail = ({ navigate }: { navigate(path: string): void }) => <><ConfigureHeader eyebrow="Feedback" title="Feedback not found" description="This deep link does not match a current Feedback entry." status="Invalid ID" /><div className="p-6"><Button onClick={() => navigate("/feedback")}>Return to Feedback</Button></div></>;
