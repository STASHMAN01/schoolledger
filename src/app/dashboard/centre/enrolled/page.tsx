"use client";

// Revised 23 Sept (Dylan): CLASSES FIRST, then the charts; adding children
// (by hand or from Excel/CSV) now lives here, replacing the old Children tab;
// children missing core details are badged and can be filtered.
//
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
import { Badge, Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { HorizontalBars, type BarRow } from "@/components/HorizontalBars";
import { AddChildForm } from "@/components/AddChildForm";
import { ImportChildrenCsv } from "@/components/ImportChildrenCsv";
import { isProfileIncomplete, missingCoreDetails } from "@/lib/childProfile";

type ChildRow = {
  id: string;
  firstName: string;
  lastName: string;
  category: { id: string; name: string };
  dateOfBirth: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  parentPhone: string | null;
  guardians?: { phone: string | null }[];
  exitDate: string | null;
  archived: boolean;
};

type ClassRow = { id: string; name: string; archived: boolean };

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
  const { organizationId, permissions } = useOrg();
  const canManage = permissions.includes("MANAGE_CHILDREN");
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [classList, setClassList] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cRes, kRes] = await Promise.all([
        fetch(`/api/organizations/${organizationId}/children`),
        fetch(`/api/organizations/${organizationId}/categories`),
      ]);
      const cData = await cRes.json().catch(() => ({}));
      const kData = await kRes.json().catch(() => ({}));
      if (cRes.ok) setChildren(cData.children ?? []);
      else setError(cData.error ?? "Couldn't load children.");
      if (kRes.ok) setClassList((kData.categories ?? []).filter((k: ClassRow) => !k.archived));
    } catch {
      setError("Couldn't load children — check your connection and refresh.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    // The to-do "Complete children's profiles" links here with ?incomplete=1.
    if (new URLSearchParams(window.location.search).get("incomplete") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the URL on mount
      setOnlyIncomplete(true);
    }
    load();
  }, [load]);

  const enrolled = useMemo(
    () => children.filter((c) => !c.archived && !c.exitDate),
    [children]
  );
  const incompleteCount = useMemo(() => enrolled.filter((c) => isProfileIncomplete(c)).length, [enrolled]);

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

  // Every class is listed (even empty ones), largest first.
  const classes = useMemo(() => {
    const q = search.trim().toLowerCase();
    const shown = enrolled.filter(
      (c) =>
        (!onlyIncomplete || isProfileIncomplete(c)) &&
        (!q || `${c.firstName} ${c.lastName}`.toLowerCase().includes(q))
    );
    const byCategory = new Map<string, { name: string; children: ChildRow[] }>();
    for (const k of classList) byCategory.set(k.id, { name: k.name, children: [] });
    for (const c of shown) {
      const entry = byCategory.get(c.category.id) ?? { name: c.category.name, children: [] };
      entry.children.push(c);
      byCategory.set(c.category.id, entry);
    }
    return [...byCategory.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .filter((k) => !(onlyIncomplete || q) || k.children.length > 0)
      .sort((a, b) => b.children.length - a.children.length || a.name.localeCompare(b.name));
  }, [enrolled, classList, onlyIncomplete, search]);

  const filtering = onlyIncomplete || search.trim().length > 0;

  return (
    <div className="animate-in">
      <PageHeader
        title="Enrolled"
        description="Every class and the children in it, then gender and age. Add children here."
        actions={
          canManage && !showAdd ? (
            <Button size="sm" onClick={() => setShowAdd(true)}>
              Add child
            </Button>
          ) : undefined
        }
      />

      {canManage && showAdd && (
        <AddChildForm
          organizationId={organizationId}
          classes={classList}
          onCancel={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}

      {canManage && classList.length > 0 && (
        <div className="mb-6">
          <ImportChildrenCsv organizationId={organizationId} categories={classList} onImported={load} />
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-6">
          <Card as="div" className="p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total enrolled</p>
                <p className="font-display mt-1 text-4xl font-semibold text-foreground">{enrolled.length}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="search"
                  placeholder="Find a child…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-44"
                  aria-label="Find a child"
                />
                {incompleteCount > 0 && (
                  <Button
                    size="sm"
                    variant={onlyIncomplete ? "primary" : "secondary"}
                    onClick={() => setOnlyIncomplete((v) => !v)}
                  >
                    {onlyIncomplete ? "Show everyone" : `Incomplete profiles (${incompleteCount})`}
                  </Button>
                )}
              </div>
            </div>

            <h2 className="font-display mb-2 text-sm font-semibold text-foreground">Classes</h2>
            {classes.length === 0 ? (
              filtering ? (
                <p className="text-sm text-muted-foreground">No children match.</p>
              ) : (
                <EmptyState
                  title="No classes yet"
                  description="Add your classes under Classes, then add children here."
                />
              )
            ) : (
              <div className="divide-y divide-border">
                {classes.map((cat) => {
                  const open = filtering || openCategory === cat.id;
                  return (
                    <div key={cat.id}>
                      <button
                        onClick={() => setOpenCategory((v) => (v === cat.id ? null : cat.id))}
                        aria-expanded={open}
                        className="transition-standard flex min-h-11 w-full items-center justify-between text-left text-sm text-foreground hover:text-brand"
                      >
                        <span className="font-medium">{cat.name}</span>
                        <span className="text-muted-foreground">{cat.children.length}</span>
                      </button>
                      {open && (
                        <div className="ml-2 border-l border-border pb-2 pl-4">
                          {cat.children.length === 0 && (
                            <p className="py-1.5 text-sm text-muted-foreground">No children in this class yet.</p>
                          )}
                          {cat.children
                            .slice()
                            .sort((a, b) => a.lastName.localeCompare(b.lastName))
                            .map((c) => {
                              const missing = missingCoreDetails(c);
                              return (
                                <Link
                                  key={c.id}
                                  href={`/dashboard/centre/children/${c.id}`}
                                  className="transition-standard flex min-h-10 flex-wrap items-center gap-2 py-1 text-sm text-foreground hover:text-brand"
                                >
                                  <span className="underline">
                                    {c.firstName} {c.lastName}
                                  </span>
                                  {missing.length > 0 && (
                                    <span title={`Missing: ${missing.join(", ")}`}>
                                      <Badge variant="danger">Incomplete profile</Badge>
                                    </span>
                                  )}
                                </Link>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
        </div>
      )}
    </div>
  );
}
