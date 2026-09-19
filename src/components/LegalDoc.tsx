// Minimal, dependency-free markdown renderer for the legal docs in
// /legal — deliberately not pulling in a markdown library for three
// small documents. Handles exactly what those files use: #/##/### headers,
// **bold**, `code`, unordered lists (-), horizontal rules (---), and
// paragraphs (including ones that wrap across several source lines, which
// is how these docs are written — joined on blank-line boundaries like
// real markdown, not split per physical line). Anything fancier in the
// source will render as plain text rather than crash.
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
  let listBuffer: string[] = [];
  let paraBuffer: string[] = [];
  let key = 0;

  function flushList() {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={`ul-${key++}`} className="my-3 list-disc space-y-1.5 pl-5 text-sm text-foreground">
        {listBuffer.map((item, i) => (
          <li key={i}>{inline(item, `li-${key}-${i}`)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
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
    if (line.startsWith("- ")) {
      flushPara();
      listBuffer.push(line.slice(2));
      continue;
    }
    if (line.startsWith("### ") || line.startsWith("## ") || line.startsWith("# ") || line.startsWith("---")) {
      flushPara();
      flushList();
      if (line.startsWith("### ")) {
        blocks.push(
          <h3 key={key++} className="font-display mt-6 text-base font-semibold text-foreground">
            {inline(line.slice(4), `h3-${key}`)}
          </h3>
        );
      } else if (line.startsWith("## ")) {
        blocks.push(
          <h2 key={key++} className="font-display mt-8 text-lg font-semibold text-foreground">
            {inline(line.slice(3), `h2-${key}`)}
          </h2>
        );
      } else if (line.startsWith("# ")) {
        blocks.push(
          <h1 key={key++} className="font-display text-2xl font-semibold text-foreground">
            {inline(line.slice(2), `h1-${key}`)}
          </h1>
        );
      } else {
        blocks.push(<hr key={key++} className="my-6 border-border" />);
      }
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      flushList();
      continue;
    }
    flushList();
    paraBuffer.push(line.trim());
  }
  flushPara();
  flushList();

  return <div>{blocks}</div>;
}
