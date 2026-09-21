// A small horizontal bar-list chart, used by the Enrolled tile's gender
// and age breakdowns (Phase 2 Session 2). Built to the dataviz skill's
// method: thin (14px, under the 24px cap) rounded-end bars on a single
// baseline, a legend dot beside every row's own label (a legend is
// "always present" for 2+ series -- putting it inline per-row rather
// than in a separate box works the same way for a bar-list), and the
// value labeled at the tip *outside* the bar rather than inside, so it
// never risks being clipped by a short bar. See globals.css for where
// --chart-cat-1/2/3 come from (the dataviz skill's validated default
// categorical palette, first three slots).
//
// `color` is a literal CSS color (var(--chart-cat-1), a hex, or an
// rgba() string) applied to the bar fill and the legend dot.
export type BarRow = {
  key: string;
  label: string;
  value: number;
  color: string;
};

export function HorizontalBars({ rows }: { rows: BarRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((sum, r) => sum + r.value, 0);

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => {
        const pct = total > 0 ? Math.round((row.value / total) * 100) : 0;
        return (
          <div key={row.key} className="flex items-center gap-3">
            <span className="flex w-28 shrink-0 items-center gap-1.5 text-sm text-foreground">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
                aria-hidden
              />
              <span className="truncate">{row.label}</span>
            </span>
            <div className="h-3.5 min-w-0 flex-1 rounded-full bg-background">
              <div
                className="h-3.5 rounded-r-[4px]"
                style={{
                  width: `${Math.max(row.value > 0 ? 3 : 0, (row.value / max) * 100)}%`,
                  backgroundColor: row.color,
                }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
              {row.value} · {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
