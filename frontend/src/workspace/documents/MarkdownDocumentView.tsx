import { CalendarDays, CheckCircle2, FileKey2, Hash, ShieldCheck, Tags, UserRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorPreview, OperationalStatus, type OperationalStatusTone } from "@/components/shared/workspace-ui";
import { cn } from "@/lib/utils";
import { MarkdownBody } from "./MarkdownBody";
import { documentTitle, type MarkdownEntity } from "./markdownDocument";

const isSimpleFrontmatterValue = (value: unknown) => value === null || ["string", "number", "boolean", "undefined"].includes(typeof value);
const isSimpleFrontmatterArray = (value: unknown[]) => value.every(isSimpleFrontmatterValue);

const frontmatterStatusTone = (status: string): OperationalStatusTone => {
  const normalized = status.toLowerCase();
  if (["ready", "healthy", "done", "accepted", "handled", "routed", "success", "active"].includes(normalized)) return "healthy";
  if (["running", "in-progress", "idle", "queued", "pending", "proposed", "received", "waiting", "at-risk"].includes(normalized)) return "attention";
  if (["failed", "blocked", "rejected", "error", "unassigned"].includes(normalized)) return "danger";
  return "neutral";
};

const frontmatterIcon = (fieldKey: string): LucideIcon => {
  if (fieldKey === "id") return Hash;
  if (["date", "created_date", "updated_date", "createdAt", "updatedAt"].includes(fieldKey)) return CalendarDays;
  if (fieldKey === "status") return CheckCircle2;
  if (["owner", "decision_authority"].includes(fieldKey)) return UserRound;
  if (fieldKey === "tags") return Tags;
  return FileKey2;
};

function FrontmatterValue({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">[]</span>;
    if (isSimpleFrontmatterArray(value)) {
      return (
        <span className="flex flex-wrap gap-1.5">
          {value.map((item, index) => (
            <Badge
              key={`${String(item)}-${index}`}
              variant={fieldKey === "tags" ? "outline" : "secondary"}
              className="h-4 rounded-xl px-1.5 font-mono text-[0.6rem] uppercase"
            >
              {String(item)}
            </Badge>
          ))}
        </span>
      );
    }
  }

  if (value && typeof value === "object") {
    return (
      <pre className="max-h-32 overflow-x-auto rounded-md bg-muted/60 p-2 text-xs leading-relaxed text-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">empty</span>;
  if (fieldKey === "status") {
    return <OperationalStatus compact label={String(value)} tone={frontmatterStatusTone(String(value))} className="uppercase" />;
  }
  return <span className="font-medium">{String(value)}</span>;
}

function FrontmatterPanel({ document }: { document: MarkdownEntity }) {
  const entries = Object.entries({ id: document.id, ...(document.frontmatter ?? {}) }).filter(([, value]) => value !== undefined);

  return (
    <aside className="rounded-lg border border-border/90 bg-panel-section px-3 py-2.5 ring-1 ring-foreground/5">
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No frontmatter.</p>
      ) : (
        <dl className="grid gap-0 sm:grid-cols-2 xl:grid-cols-4">
          {entries.map(([key, value], index) => {
            const Icon = frontmatterIcon(key);
            const isComplexObject = Boolean(value && typeof value === "object" && !Array.isArray(value));
            return (
              <div
                key={key}
                className={cn(
                  "min-w-0 border-border/70 py-2 pr-4",
                  index > 0 && "sm:border-l sm:pl-4",
                  isComplexObject && "sm:col-span-2 xl:col-span-4"
                )}
              >
                <dt className="mb-1.5 flex items-center gap-1.5 font-mono text-[0.65rem] font-semibold uppercase leading-none text-muted-foreground">
                  <Icon className="size-3" />
                  {key}
                </dt>
                <dd className="min-w-0 break-words text-sm leading-snug text-foreground">
                  <FrontmatterValue fieldKey={key} value={value} />
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </aside>
  );
}

export function MarkdownDocumentView({ document, emptyTitle, compact = false, embedded = false }: { document?: MarkdownEntity; emptyTitle: string; compact?: boolean; embedded?: boolean }) {
  if (!document) return <EmptyState title={emptyTitle} />;
  const title = documentTitle(document);

  return (
    <div className="grid auto-rows-min gap-4 self-start">
      <article className={cn("min-w-0", embedded ? "p-0" : "rounded-lg border bg-card p-5 md:p-8")}>
        <header className="mb-4 grid gap-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1 flex items-center gap-2 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.05em] text-primary">
                <FileKey2 className="size-3.5" />
                {document.relativePath ?? document.id}
              </p>
              <h1 className="truncate text-xl font-semibold leading-tight text-foreground md:text-2xl">{title}</h1>
            </div>
            <ShieldCheck className="hidden size-10 shrink-0 text-muted-foreground/30 sm:block" />
          </div>
          <FrontmatterPanel document={document} />
        </header>
        {document.errors?.length ? (
          <header className="mb-6 flex min-w-0 flex-wrap items-center gap-2 border-b pb-5">
            <ErrorPreview errors={document.errors} />
          </header>
        ) : null}
        <div className={cn(compact && "markdown-body-compact")}>
          <MarkdownBody source={document.body} title={title} />
        </div>
      </article>
    </div>
  );
}
