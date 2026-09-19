// Minimal, dependency-free markdown renderer for the legal docs in
// /legal — deliberately not pulling in a markdown library for three
// small documents. Handles #/##/### headers, **bold**, `code`, unordered
// lists (-), horizontal rules (---), and paragraphs — including ones
// that wrap across several source lines, which is how these docs are
// actually written (a paragraph or list item continues until a blank
// line, same as real markdown, not one <p>/<li> per physical line).
//
// FIX (found live on /privacy after deploy, 2026-09-19): the first
// version of this only merged wrapped *paragraph* lines, not wrapped
// *list item* lines — a bullet like "- **The children...\n  Service**
// (names...)" split into a truncated bullet plus an orphaned paragraph,
// visibly mangling several bullets on /privacy and /terms. Fixed by
// tracking "currently inside a list item" the same way paragraphs are
// buffered, so a continuation line (indented, no "- ") gets appended to
// the open list item instead of starting a new paragraph.
function inline(text: string, keyPrefix: string) {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={`${keyPrefix}-${i++}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(
        <code key={`${keyPrefix}-${i++}`} className="rounded bg-surface px-1 py-0.5 text-[0.85em]">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      const m = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (m) {
        parts.push(
          <a key={`${keyPrefix}-${i++}`} href={m[2]} className="text-brand hover:underline">
            {m[1]}
          </a>
        );
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function LegalDoc({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listItemBuffer: string[] | null = null; // words of the list item currently being built
  let paraBuffer: string[] = [];
  let key = 0;

  function closeListItem() {
    if (listItemBuffer) {
      listItems.push(listItemBuffer.join(" ").trim());
      listItemBuffer = null;
    }
  }

  function flushList() {
    closeListItem();
    if (listItems.length === 0) return;
    const items = listItems;
    listItems = [];
    blocks.push(
      <ul key={`ul-${key++}`} className="my-3 list-disc space-y-1.5 pl-5 text-sm text-foreground">
        {items.map((item, i) => (
          <li key={i}>{inline(item, `li-${key}-${i}`)}</li>
        ))}
      </ul>
    );
  }

  function flushPara() {
    if (paraBuffer.length === 0) return;
    const text = paraBuffer.join(" ").trim();
    paraBuffer = [];
    if (!text) return;
    if (text.startsWith("_") && text.endsWith("_")) {
      blocks.push(
        <p key={key++} className="text-xs italic text-muted-foreground">
          {text.slice(1, -1)}
        </p>
      );
      return;
    }
    blocks.push(
      <p key={key++} className="mt-3 text-sm leading-relaxed text-foreground">
        {inline(text, `p-${key}`)}
      </p>
    );
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("- ")) {
      // New list item — close whichever item was open, start a new one.
      flushPara();
      closeListItem();
      listItemBuffer = [trimmed.slice(2).trim()];
      continue;
    }

    if (
      trimmed.startsWith("### ") ||
      trimmed.startsWith("## ") ||
      trimmed.startsWith("# ") ||
      trimmed.startsWith("---")
    ) {
      flushPara();
      flushList();
      if (trimmed.startsWith("### ")) {
        blocks.push(
          <h3 key={key++} className="font-display mt-6 text-base font-semibold text-foreground">
            {inline(trimmed.slice(4), `h3-${key}`)}
          </h3>
        );
      } else if (trimmed.startsWith("## ")) {
        blocks.push(
          <h2 key={key++} className="font-display mt-8 text-lg font-semibold text-foreground">
            {inline(trimmed.slice(3), `h2-${key}`)}
          </h2>
        );
      } else if (trimmed.startsWith("# ")) {
        blocks.push(
          <h1 key={key++} className="font-display text-2xl font-semibold text-foreground">
            {inline(trimmed.slice(2), `h1-${key}`)}
          </h1>
        );
      } else {
        blocks.push(<hr key={key++} className="my-6 border-border" />);
      }
      continue;
    }

    if (trimmed === "") {
      // Blank line ends whatever paragraph or list item was open.
      flushPara();
      flushList();
      continue;
    }

    // A plain continuation line: if a list item is currently open, this
    // is its wrapped continuation (real markdown semantics); otherwise
    // it's part of the current paragraph.
    if (listItemBuffer) {
      listItemBuffer.push(trimmed);
    } else {
      paraBuffer.push(trimmed);
    }
  }
  flushPara();
  flushList();

  return <div>{blocks}</div>;
}
