import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { removeMatchingLeadingH1 } from "./markdownDocument";

export function MarkdownBody({
  source,
  title,
  emptyText = "No Markdown body."
}: {
  source?: string;
  title?: string;
  emptyText?: string;
}) {
  const body = removeMatchingLeadingH1(source?.trim() ?? "", title).trim();
  if (!body) return <p className="text-muted-foreground">{emptyText}</p>;

  return (
    <div className="markdown-body markdown-document-preview">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}
