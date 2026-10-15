// Class groups and grades (Dylan, 15 Oct 2026 -- reverses the old "categories
// are a flat list" rule, docs/PLAN.md decision #11).
//
// A GROUP is an ordinary top-level class (Category.parentId null) such as
// Aftercare or Homeschool. It is "the room": teacher, register, classwork,
// fees, tasks etc. all hang off it, and children's categoryId is the group.
//
// A GRADE is a sub-class: a Category whose parentId is the group. One level
// only -- a grade can't have grades, has no fee, no teacher and no age range,
// and is never a child's categoryId. A child in a group may carry an optional
// Child.subCategoryId pointing at one of that group's grades. That is a
// LABEL for display / filtering / sorting only: it is never used for access
// control (teachers stay scoped by categoryId).
//
// Everything here is pure (no database) so it can be unit-tested.

export const GRADE_PRESET: readonly string[] = [
  "Gr R",
  ...Array.from({ length: 12 }, (_, i) => `Gr ${i + 1}`),
];

export const MAX_GRADES_PER_GROUP = 30;
export const MAX_GRADE_NAME_LENGTH = 60;

// Prisma `where` fragment for "this is a real class, not a grade". Every
// server-side place that lists classes, counts classes or validates a
// chosen class (child's class, teacher's class, task/event/lesson target)
// must include this.
export const TOP_LEVEL_ONLY = { parentId: null } as const;

// ---- Grade names -------------------------------------------------------

// A comparison key that makes "Gr 3", "Grade 3", "gr3", "3" and " GR  03 "
// equal, and "R", "Grade R", "gr r" equal. Names that aren't a standard
// grade ("Playgroup", "Year 1") just compare case/space/punctuation-blind.
export function gradeKey(name: string): string {
  const c = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const m = /^(?:grade|gr)?(r|\d{1,2})$/.exec(c);
  if (m) return m[1] === "r" ? "r" : String(parseInt(m[1], 10));
  return c;
}

export function sameGradeName(a: string, b: string): boolean {
  const ka = gradeKey(a);
  return ka !== "" && ka === gradeKey(b);
}

// Tolerant matcher for the Excel/CSV import: the grade of `grades` that the
// typed text means, or null.
export function matchGrade<T extends { name: string }>(grades: readonly T[], input: string): T | null {
  const key = gradeKey(input);
  if (!key) return null;
  return grades.find((g) => gradeKey(g.name) === key) ?? null;
}

export function gradeNameProblem(name: string, existingNames: readonly string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Grade name is required.";
  if (trimmed.length > MAX_GRADE_NAME_LENGTH) return `Grade names can be at most ${MAX_GRADE_NAME_LENGTH} characters.`;
  if (existingNames.some((n) => sameGradeName(n, trimmed))) {
    return `There is already a grade called "${trimmed}" in this class.`;
  }
  return null;
}

// Cleans a list of grade names typed/ticked on the "Group with grades" form:
// trims, drops blanks, and rejects duplicates (case-insensitive, "Gr 3" ==
// "Grade 3") rather than silently merging them, so the owner sees the mistake.
export function normaliseGradeList(
  names: readonly string[],
  existingNames: readonly string[] = []
): { names: string[]; problem: string | null } {
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name) continue;
    const problem = gradeNameProblem(name, [...existingNames, ...out]);
    if (problem) return { names: out, problem };
    out.push(name);
  }
  if (existingNames.length + out.length > MAX_GRADES_PER_GROUP) {
    return { names: out, problem: `A class can have at most ${MAX_GRADES_PER_GROUP} grades.` };
  }
  return { names: out, problem: null };
}

// Reads a Grade cell from the Excel/CSV import against one class's grades.
// `grades` are that class's grades, in display order (archived ones included,
// so they get a useful message). Blank -> no grade. A grade for a class without grades, or
// one that matches nothing, is a row error (never silently dropped).
export function resolveImportGrade<T extends { name: string; archived: boolean }>(
  className: string,
  grades: readonly T[],
  text: string
): { grade: T | null; error?: undefined } | { grade?: undefined; error: string } {
  const value = text.trim();
  if (!value) return { grade: null };
  const active = grades.filter((g) => !g.archived);
  if (active.length === 0) {
    return {
      error: `Grade "${value}" can't be used: "${className}" has no grades. Leave the Grade blank, or add the grades to the class first.`,
    };
  }
  const match = matchGrade(active, value);
  if (match) return { grade: match };
  if (matchGrade(grades, value)) {
    return { error: `Grade "${value}" in "${className}" is archived. Restore it first or choose another grade.` };
  }
  const options = active.map((g) => g.name).join(", ");
  return { error: `Grade "${value}" doesn't match any grade in "${className}" (${options}). Fix it or leave it blank.` };
}

// ---- Ordering ----------------------------------------------------------

type OrderableGrade = { id?: string; name: string; createdAt: Date | string };

function time(d: Date | string): number {
  return typeof d === "string" ? new Date(d).getTime() : d.getTime();
}

function presetIndex(name: string): number {
  return GRADE_PRESET.findIndex((p) => gradeKey(p) === gradeKey(name));
}

// Grades are shown in the order they were created -- the preset is created
// in order (Gr R, Gr 1 ... Gr 12), so that reads naturally. Ties (rows made
// in the same millisecond) fall back to the preset order, then the name.
export function compareGrades(a: OrderableGrade, b: OrderableGrade): number {
  const dt = time(a.createdAt) - time(b.createdAt);
  if (dt !== 0) return dt;
  const pa = presetIndex(a.name);
  const pb = presetIndex(b.name);
  if (pa !== -1 && pb !== -1 && pa !== pb) return pa - pb;
  return a.name.localeCompare(b.name);
}

export function orderGrades<T extends OrderableGrade>(grades: readonly T[]): T[] {
  return [...grades].sort(compareGrades);
}

// createdAt values for a batch of new grades so the order they were typed in
// is the order they sort in, even though they are written in one transaction.
export function stagedCreatedAt(count: number, base: Date = new Date()): Date[] {
  return Array.from({ length: count }, (_, i) => new Date(base.getTime() + i));
}

// Position of each grade id in display order (for sorting children).
export function gradeRankMap<T extends OrderableGrade & { id: string }>(grades: readonly T[]): Map<string, number> {
  return new Map(orderGrades(grades).map((g, i) => [g.id, i]));
}

// Sorts children by grade (display order; no grade last) and then by name.
export function sortChildrenByGrade<T extends { subCategoryId?: string | null; lastName: string; firstName: string }>(
  children: readonly T[],
  rank: ReadonlyMap<string, number>
): T[] {
  const r = (c: T) => (c.subCategoryId && rank.has(c.subCategoryId) ? rank.get(c.subCategoryId)! : Number.MAX_SAFE_INTEGER);
  return [...children].sort(
    (a, b) => r(a) - r(b) || a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
  );
}

// ---- Display -----------------------------------------------------------

// "Aftercare · Gr 3", or just the class name when the child has no grade.
export function classLabel(className: string, gradeName?: string | null): string {
  return gradeName ? `${className} · ${gradeName}` : className;
}

// ---- Assigning a grade to a child ----------------------------------------

type GradeRow = { parentId: string | null; archived: boolean; deletedAt?: Date | null };

// null = OK. `grade` is the Category row looked up by the requested id (null
// when it doesn't exist in the organisation). It must be a live, non-archived
// grade whose parent is the child's class.
export function gradeAssignmentProblem(grade: GradeRow | null, childClassId: string): string | null {
  if (!grade || grade.deletedAt) return "That grade doesn't exist.";
  if (grade.parentId == null || grade.parentId !== childClassId) return "That grade doesn't belong to the child's class.";
  if (grade.archived) return "That grade is archived. Restore it or pick another grade.";
  return null;
}

// What to store in Child.subCategoryId on an update. `requested` is the
// value in the request (undefined = not sent; a string has been validated by
// the caller with gradeAssignmentProblem). If the class changes and no new
// grade was sent, the old grade (which belongs to the old class) is cleared.
// undefined = leave the column alone.
export function nextSubCategoryId(args: {
  current: string | null;
  requested: string | null | undefined;
  oldClassId: string;
  newClassId: string;
}): string | null | undefined {
  if (args.requested !== undefined) return args.requested;
  if (args.oldClassId !== args.newClassId && args.current) return null;
  return undefined;
}

// Archiving (or deleting) a grade that children are still labelled with is
// refused: the owner must move those children to another grade first.
export function gradeInUseProblem(gradeName: string, childCount: number): string | null {
  if (childCount <= 0) return null;
  return `${childCount} ${childCount === 1 ? "child is" : "children are"} still in ${gradeName}. Move them to another grade first.`;
}

export function groupHasGradedChildrenProblem(className: string, gradeCount: number, gradedChildren: number): string | null {
  if (gradeCount <= 0 || gradedChildren <= 0) return null;
  return `${className} still has ${gradedChildren} ${
    gradedChildren === 1 ? "child" : "children"
  } with a grade. Move them to another grade or class first.`;
}
