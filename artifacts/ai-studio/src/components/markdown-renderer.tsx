import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodePreview } from "./code-preview";

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || "");
          const codeString = String(children).replace(/\n$/, "");
          const isBlock = codeString.includes("\n") || !!match;
          if (isBlock) return <CodePreview code={codeString} language={match ? match[1] : "text"} />;
          return <code className="bg-white/10 px-1.5 py-0.5 rounded text-[0.8em] font-mono" {...props}>{children}</code>;
        },
        p({ children }) { return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>; },
        ul({ children }) { return <ul className="mb-3 ml-5 list-disc space-y-1">{children}</ul>; },
        ol({ children }) { return <ol className="mb-3 ml-5 list-decimal space-y-1">{children}</ol>; },
        li({ children }) { return <li className="leading-relaxed">{children}</li>; },
        h1({ children }) { return <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0">{children}</h1>; },
        h2({ children }) { return <h2 className="text-lg font-semibold mb-2 mt-4 first:mt-0">{children}</h2>; },
        h3({ children }) { return <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h3>; },
        strong({ children }) { return <strong className="font-semibold">{children}</strong>; },
        em({ children }) { return <em className="italic">{children}</em>; },
        a({ href, children }) {
          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity">{children}</a>;
        },
        blockquote({ children }) {
          return <blockquote className="border-l-2 border-primary/60 pl-4 my-3 text-muted-foreground italic">{children}</blockquote>;
        },
        table({ children }) {
          return <div className="overflow-x-auto my-3 rounded-lg border border-border/50"><table className="min-w-full border-collapse text-sm">{children}</table></div>;
        },
        th({ children }) { return <th className="border-b border-border px-4 py-2 bg-muted text-left font-semibold text-xs uppercase tracking-wider">{children}</th>; },
        td({ children }) { return <td className="border-b border-border/30 px-4 py-2 last:border-0">{children}</td>; },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
