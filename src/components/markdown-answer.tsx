import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders a question-bank answer (Markdown: headings, lists, tables, code).
 * Raw HTML in the source is not rendered (react-markdown's default), so an
 * imported answer can never inject markup or scripts.
 */
const components: Components = {
  h1: (p) => <h3 className="mt-5 mb-2 text-base font-semibold" {...p} />,
  h2: (p) => <h3 className="mt-5 mb-2 text-base font-semibold" {...p} />,
  h3: (p) => <h4 className="mt-4 mb-1.5 text-[0.95em] font-semibold" {...p} />,
  h4: (p) => <h5 className="mt-3 mb-1 font-semibold" {...p} />,
  p: (p) => <p className="my-2" {...p} />,
  ul: (p) => <ul className="my-2 list-disc space-y-1 pl-5" {...p} />,
  ol: (p) => <ol className="my-2 list-decimal space-y-1 pl-5" {...p} />,
  li: (p) => <li className="pl-0.5" {...p} />,
  strong: (p) => <strong className="font-semibold text-foreground" {...p} />,
  a: ({ href, ...p }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="underline underline-offset-4 hover:text-foreground"
      {...p}
    />
  ),
  blockquote: (p) => (
    <blockquote
      className="my-3 border-l-2 border-primary/50 pl-3 text-muted-foreground"
      {...p}
    />
  ),
  pre: (p) => (
    <pre
      className="scrollbar-thin my-3 overflow-x-auto rounded-lg border bg-surface p-3 font-mono text-[0.8rem] leading-relaxed"
      {...p}
    />
  ),
  code: ({ className, ...p }) =>
    // Fenced blocks carry a language-* class (or sit in <pre>); inline code gets a chip.
    className?.startsWith("language-") ? (
      <code className={className} {...p} />
    ) : (
      <code
        className="rounded bg-surface px-1 py-0.5 font-mono text-[0.85em]"
        {...p}
      />
    ),
  table: (p) => (
    <div className="scrollbar-thin my-3 overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-[0.85rem]" {...p} />
    </div>
  ),
  th: (p) => (
    <th className="border-b bg-surface px-3 py-2 font-medium" {...p} />
  ),
  td: (p) => <td className="border-b px-3 py-2 align-top" {...p} />,
  hr: () => <hr className="my-4" />,
};

export function MarkdownAnswer({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
