// Number tile shared by the Centre Management and Accounting home pages
// (Dylan's mock-up, 23 Sept; Accounting matched to it 24 Sept): a blue
// title bar, a big number and a one-line hint. It is either a link to the
// page behind the number, or a button that opens a breakdown below.
import Link from "next/link";

export function TileHeader({ title }: { title: string }) {
  return <p className="bg-brand px-3 py-1.5 text-sm font-semibold text-brand-foreground">{title}</p>;
}

type TileProps = {
  title: string;
  value: number | string;
  hint: string;
  /** Hint shown in red (something needs attention). */
  warn?: boolean;
  /** Money and other long values use a slightly smaller number. */
  compact?: boolean;
} & ({ href: string; onClick?: never; expanded?: never } | { href?: never; onClick: () => void; expanded: boolean });

export function Tile({ title, value, hint, warn, compact, href, onClick, expanded }: TileProps) {
  const inner = (
    <>
      <TileHeader title={title} />
      <div className="p-3">
        <p
          className={`font-display break-words font-semibold text-foreground ${compact ? "text-xl" : "text-2xl"}`}
        >
          {value}
        </p>
        <p className={`mt-1 text-xs ${warn ? "text-danger" : "text-muted"}`}>{hint}</p>
      </div>
    </>
  );
  const cls =
    "transition-standard block w-full overflow-hidden rounded-xl border bg-surface text-left hover:border-border-strong";
  if (href) {
    return (
      <Link href={href} className={`${cls} border-border`}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className={`${cls} ${expanded ? "border-brand ring-1 ring-brand" : "border-border"}`}
    >
      {inner}
    </button>
  );
}
