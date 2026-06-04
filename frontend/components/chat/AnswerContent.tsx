/**
 * AnswerContent — renders an assistant answer as lightweight, safe markdown
 * with inline [N] citation chips. No raw HTML is ever injected.
 *
 * Supports: paragraphs, blank-line breaks, fenced code blocks, `inline code`,
 * **bold**, *italic*, simple "- " bullet lists, and [N] citation references.
 */
import { Fragment, type ReactNode } from "react";
import type { Citation } from "@/lib/api-client";
import { cn } from "@/lib/utils";

function renderInline(text: string, onCite?: (index: number) => void, keyBase = ""): ReactNode[] {
  // Tokenize on citations, inline code, bold, italic — in priority order.
  const pattern = /(\[\d+\])|(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;

    if (m[1]) {
      const idx = parseInt(tok.slice(1, -1), 10);
      out.push(
        <button
          key={key}
          onClick={() => onCite?.(idx)}
          className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded border px-1 align-baseline
            text-[10px] font-semibold leading-none transition-colors
            border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-accent-subtle text-accent
            hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]"
          aria-label={`Source ${idx}`}
        >
          {idx}
        </button>
      );
    } else if (m[2]) {
      out.push(
        <code key={key} className="rounded border border-line bg-sunken px-1.5 py-0.5 font-mono text-[12px] text-fg">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (m[3]) {
      out.push(<strong key={key} className="font-semibold text-fg">{tok.slice(2, -2)}</strong>);
    } else if (m[4]) {
      out.push(<em key={key} className="italic">{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function AnswerContent({
  content,
  onCite,
  className,
}: {
  content: string;
  onCite?: (index: number) => void;
  className?: string;
}) {
  const blocks = content.split(/```/);

  return (
    <div className={cn("space-y-3 text-[15px] leading-relaxed text-fg", className)}>
      {blocks.map((block, bi) => {
        // Odd indices are fenced code blocks.
        if (bi % 2 === 1) {
          const code = block.replace(/^[a-zA-Z]*\n/, "");
          return (
            <pre key={bi} className="overflow-x-auto rounded-xl border border-line bg-sunken p-3 font-mono text-[12px] text-muted">
              <code>{code.trimEnd()}</code>
            </pre>
          );
        }

        const lines = block.split("\n");
        const nodes: ReactNode[] = [];
        let bullets: string[] = [];

        const flushBullets = (k: string) => {
          if (!bullets.length) return;
          nodes.push(
            <ul key={`ul-${k}`} className="list-disc pl-5 space-y-1">
              {bullets.map((b, j) => (
                <li key={j}>{renderInline(b, onCite, `${k}-${j}`)}</li>
              ))}
            </ul>
          );
          bullets = [];
        };

        lines.forEach((line, li) => {
          const trimmed = line.trim();
          if (/^[-*]\s+/.test(trimmed)) {
            bullets.push(trimmed.replace(/^[-*]\s+/, ""));
          } else if (trimmed === "") {
            flushBullets(`${bi}-${li}`);
          } else {
            flushBullets(`${bi}-${li}`);
            nodes.push(
              <p key={`p-${bi}-${li}`}>{renderInline(trimmed, onCite, `${bi}-${li}`)}</p>
            );
          }
        });
        flushBullets(`${bi}-end`);

        return <Fragment key={bi}>{nodes}</Fragment>;
      })}
    </div>
  );
}
