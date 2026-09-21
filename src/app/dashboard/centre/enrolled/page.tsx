"use client";

// Enrolled -- total currently-enrolled learners, then gender and age
// breakdown charts, then classes with counts drilling into the children
// in that class (Phase 2 Session 2 per docs/PLAN.md: "Enrolled: total
// learners -> charts (gender, age) -> classes with counts -> class list
// -> child profile"). "Currently enrolled" excludes archived children and
// anyone with an exit date -- exits are Admissions' job to surface, not
// this tile's. No money anywhere on this page, same rule as the rest of
// Centre Management. Chart form/color follows the dataviz skill: see
// HorizontalBars.tsx and globals.css's --chart-cat-1/2/3.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useOrg } from "../../OrgContext";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { HorizontalBars, type BarRow } from "@/components/HorizontalBars";

type ChildRow = {
  id: string;
  firstName: string;
  lastName: string;
  category: { id: string; name: string };
  dateOfBirth: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  exitDate: string | null;
  archived: boolean;
};

const NOT_SPECIFIED = "var(--muted)";

// Whole years as of today -- a preschool cares about "turned 3", not days.
function ageInYears(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

// Ordinal age bands: order carries meaning (youngest -> oldest), so per
// the dataviz skill this is a one-hue ramp with monotone lightness/weight
// steps, not a categorical palette -- implemented here as increasing
// opacity on the single sequential hue (--chart-cat-1), computed evenly
// across the band count rather than eyeballed.
const AGE_BANDS: { key: string; label: string; test: (age: number) => boolean }[] = [
  { key: "0", label: "Under 1", test: (a) => a < 1 },
  { key: "1", label: "1", test: (a) => a === 1 },
  { key: "2", label: "2", test: (a) => a === 2 },
  { key: "3", label: "3", test: (a) => a === 3 },
  { key: "4", label: "4", test: (a) => a === 4 },
  { key: "5", label: "5", test: (a) => a === 5 },
  { key: "6", label: "6+", test: (a) => a >= 6 },
];

function ageColor(index: number): string {
  const pct = Math.round(40 + (index / (AGE_BANDS.length - 1)) * 60);
  return `color-mix(in srgb, var(--chart-cat-1) ${pct}%, transparent)`;
}

export default function EnrolledPage() {
  const { organizationId } = useOrg();
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/organizations/${organizationId}/children`);
    const data = await res.json();
    if (res.ok) setChildren(data.children);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount, standard pattern
    load();
  }, [load]);

  const enrolled = useMemo(
    () => children.filter((c) => !c.archived && !c.exitDate),
    [children]
  );

  const genderRows: BarRow[] = useMemo(() => {
    const counts = { MALE: 0, FEMALE: 0, OTHER: 0, none: 0 };
    for (const c of enrolled) {
      if (c.gender === "MALE") counts.MALE++;
      else if (c.gender === "FEMALE") counts.FEMALE++;
      else if (c.gender === "OTHER") counts.OTHER++;
      else counts.none++;
    }
    return [
      { key: "MALE", label: "Male", value: counts.MALE, color: "var(--chart-cat-1)" },
      { key: "FEMALE", label: "Female", value: counts.FEMALE, color: "var(--chart-cat-2)" },
      { key: "OTHER", label: "Other", value: counts.OTHER, color: "var(--chart-cat-3)" },
      { key: "none", label: "Not specified", value: counts.none, color: NOT_SPECIFIED },
    ];
  }, [enrolled]);

  const ageRows: BarRow[] = useMemo(() => {
    const counts = new Map(AGE_BANDS.map((b) => [b.key, 0]));
    let unknown = 0;
    for (const c of enrolled) {
      if (!c.dateOfBirth) {
        unknown++;
        continue;
      }
      const age = ageInYears(c.dateOfBirth);
      const band = AGE_BANDS.find((b) => b.test(age));
      if (band) counts.set(band.key, (counts.get(band.key) ?? 0) + 1);
      else unknown++;
    }
    const rows: BarRow[] = AGE_BANDS.map((b, i) => ({
      key: b.key,
      label: b.label,
      value: counts.get(b.key) ?? 0,
      color: ageColor(i),
    }));
    rows.push({ key: "unknown", label: "Unknown", value: unknown, color: NOT_SPECIFIED });
    return rows;
  }, [enrolled]);

  const classes = useMemo(() => {
    const byCategory = new Map<string, { name: string; children: ChildRow[] }>();
    for (const c of enrolled) {
      const entry = byCategory.get(c.category.id) ?? { name: c.category.name, children: [] };
      entry.children.push(c);
      byCategory.set(c.category.id, entry);
    }
    return [...byCategory.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.children.length - a.children.length);
  }, [enrolled]);

  return (
    <div className="animate-in">
      <PageHeader title="Enrolled" description="Currently-enrolled learners, by gender, age and class." />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-6">
          <Card as="div" className="p-5">
            <p className="text-xs text-muted-foreground">Total enrolled</p>
            <p className="font-display mt-1 text-4xl font-semibold text-foreground">
              {enrolled.length}
            </p>
          </Card>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card as="div" className="p-5">
              <h2 className="font-display mb-4 text-sm font-semibold text-foreground">Gender</h2>
              {enrolled.length === 0 ? (
                <p className="text-sm text-muted-foreground">No enrolled children yet.</p>
              ) : (
                <HorizontalBars rows={genderRows} />
              )}
            </Card>

            <Card as="div" className="p-5">
              <h2 className="font-display mb-4 text-sm font-semibold text-foreground">Age</h2>
              {enrolled.length === 0 ? (
                <p className="text-sm text-muted-foreground">No enrolled children yet.</p>
              ) : (
                <HorizontalBars rows={ageRows} />
              )}
            </Card>
          </div>

          <Card as="div" className="p-5">
            <h2 className="font-display mb-3 text-sm font-semibold text-foreground">Classes</h2>
            {classes.length === 0 ? (
              <EmptyState
                title="No classes yet"
                description="Add a class under Accounting to start enrolling children into it."
              />
            ) : (
              <div className="divide-y divide-border">
                {classes.map((cat) => (
                  <div key={cat.id}>
                    <button
                      onClick={() => setOpenCategory((v) => (v === cat.id ? null : cat.id))}
                      className="transition-standard flex w-full items-center justify-between py-2.5 text-left text-sm text-foreground hover:text-brand"
                    >
                      <span className="font-medium">{cat.name}</span>
                      <span className="text-muted-foreground">{cat.children.length}</span>
                    </button>
                    {openCategory === cat.id && (
                      <div className="ml-4 border-l border-border pl-4 pb-2">
                        {cat.children
                          .slice()
                          .sort((a, b) => a.lastName.localeCompare(b.lastName))
                          .map((c) => (
                            <Link
                              key={c.id}
                              href={`/dashboard/centre/children/${c.id}`}
                              className="transition-standard block py-1.5 text-sm text-muted-foreground underline hover:text-foreground"
                            >
                              {c.firstName} {c.lastName}
                            </Link>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
