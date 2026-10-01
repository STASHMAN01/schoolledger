// Small "what it looks like" panels for the homepage features section
// (Dylan, 1 Oct 2026: "show features clearly with what each looks like").
// Same approach the hero's "today" card already uses — the shape of a
// real screen, typeset rather than photographed, with a visible "Sample
// data" caption — rather than a screenshot of the real app (which would
// show a real school's names/numbers) or an invented dashboard photo
// that overstates what exists. Fictional names/numbers throughout.

function PreviewFrame({
  title,
  tag,
  children,
}: {
  title: string;
  tag?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border-strong bg-surface">
      <div className="flex items-baseline justify-between border-b border-border-strong px-4 py-2.5">
        <span className="font-display text-xs font-semibold text-foreground">{title}</span>
        {tag && <span className="font-mono text-[10px] text-muted-foreground">{tag}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function FeesPreview() {
  const rows = [
    { name: "Naledi M.", status: "Paid", tone: "ok" as const },
    { name: "Thabo K.", status: "R850 owing", tone: "warn" as const },
    { name: "Aisha P.", status: "Paid", tone: "ok" as const },
    { name: "Liam S.", status: "R1,700 owing", tone: "warn" as const },
  ];
  return (
    <PreviewFrame title="Fees — Grade R" tag="This month">
      <dl className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.name} className="flex items-baseline gap-3">
            <dt className="text-xs text-foreground">{r.name}</dt>
            <div className="flex-1 border-b border-dotted border-border-strong" aria-hidden="true" />
            <dd className={`font-mono text-xs ${r.tone === "ok" ? "text-success" : "text-accent-soft-foreground"}`}>
              {r.status}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
        <span className="text-muted-foreground">Class total outstanding</span>
        <span className="font-mono font-medium text-foreground">R2,550</span>
      </div>
    </PreviewFrame>
  );
}

export function RemindersPreview() {
  return (
    <PreviewFrame title="Send reminders" tag="Grade R · 18 families">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-foreground">Families with an outstanding balance</span>
          <span className="font-mono text-foreground">6</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
          <div className="h-full w-4/5 rounded-full bg-brand" aria-hidden="true" />
        </div>
        <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <span className="text-success">✓</span> Emailed 5 families, with each statement attached
          </li>
          <li className="flex items-center gap-2">
            <span className="text-accent-soft-foreground">!</span> 1 skipped — no email on file
          </li>
        </ul>
      </div>
    </PreviewFrame>
  );
}

export function AttendancePreview() {
  const rows = [
    { name: "Naledi M.", present: true },
    { name: "Thabo K.", present: true },
    { name: "Aisha P.", present: false },
    { name: "Liam S.", present: true },
    { name: "Zinhle N.", present: true },
  ];
  return (
    <PreviewFrame title="Register — Grade R" tag="Today">
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-3 text-xs">
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[10px] ${
                r.present ? "border-success bg-success-soft text-success" : "border-border-strong text-muted-foreground"
              }`}
              aria-hidden="true"
            >
              {r.present ? "✓" : ""}
            </span>
            <span className="text-foreground">{r.name}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
        4 present · 1 absent — notify parent not yet sent
      </div>
    </PreviewFrame>
  );
}

export function DocumentsPreview() {
  const rows = [
    { label: "Birth certificate", have: true },
    { label: "Clinic card", have: true },
    { label: "Parent ID (mother)", have: false },
    { label: "Parent ID (father)", have: true },
  ];
  return (
    <PreviewFrame title="Documents — Thabo K." tag="1 missing">
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 text-xs">
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[10px] ${
                r.have ? "border-success bg-success-soft text-success" : "border-accent-soft-foreground text-accent-soft-foreground"
              }`}
              aria-hidden="true"
            >
              {r.have ? "✓" : "!"}
            </span>
            <span className={r.have ? "text-foreground" : "text-accent-soft-foreground"}>{r.label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
        Share an upload link and the parent adds it from their phone.
      </div>
    </PreviewFrame>
  );
}
