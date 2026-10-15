import { describe, it, expect } from "vitest";
import {
  GRADE_PRESET,
  classLabel,
  compareGrades,
  gradeAssignmentProblem,
  gradeInUseProblem,
  gradeKey,
  gradeNameProblem,
  gradeInfo,
  gradeRankMap,
  matchGrade,
  nextSubCategoryId,
  normaliseGradeList,
  orderGrades,
  resolveImportGrade,
  sameGradeName,
  sortChildrenByGrade,
  stagedCreatedAt,
} from "./classGroups";

const g = (name: string, t = 0, archived = false, id = name) => ({
  id,
  name,
  archived,
  createdAt: new Date(2026, 0, 1, 0, 0, 0, t),
});

describe("grade preset", () => {
  it("runs Gr R then Gr 1 to Gr 12", () => {
    expect(GRADE_PRESET).toHaveLength(13);
    expect(GRADE_PRESET[0]).toBe("Gr R");
    expect(GRADE_PRESET[1]).toBe("Gr 1");
    expect(GRADE_PRESET[12]).toBe("Gr 12");
  });
});

describe("gradeKey / tolerant matching", () => {
  it("reads Gr 3, Grade 3, gr3 and 3 as the same grade", () => {
    for (const v of ["Gr 3", "Grade 3", "gr3", "3", " GR  03 ", "grade3", "Gr. 3"]) {
      expect(gradeKey(v)).toBe("3");
    }
  });

  it("reads R, Grade R and Gr R as Grade R", () => {
    for (const v of ["R", "r", "Grade R", "gr r", "GRADE  R", "GrR"]) {
      expect(gradeKey(v)).toBe("r");
    }
  });

  it("keeps different grades apart", () => {
    expect(sameGradeName("Gr 1", "Gr 11")).toBe(false);
    expect(sameGradeName("Gr 1", "Gr 12")).toBe(false);
    expect(sameGradeName("Gr R", "Gr 1")).toBe(false);
    expect(gradeKey("12")).toBe("12");
  });

  it("compares custom names ignoring case, spaces and punctuation", () => {
    expect(sameGradeName("Play group", "playgroup")).toBe(true);
    expect(sameGradeName("Play group", "Toddlers")).toBe(false);
  });

  it("never matches an empty name", () => {
    expect(sameGradeName("", "")).toBe(false);
    expect(matchGrade([g("Gr 1")], "  ")).toBeNull();
  });

  it("finds the grade a typed value means", () => {
    const grades = GRADE_PRESET.map((n, i) => g(n, i));
    expect(matchGrade(grades, "Grade 3")?.name).toBe("Gr 3");
    expect(matchGrade(grades, "gr10")?.name).toBe("Gr 10");
    expect(matchGrade(grades, "10")?.name).toBe("Gr 10");
    expect(matchGrade(grades, "R")?.name).toBe("Gr R");
    expect(matchGrade(grades, "Grade R")?.name).toBe("Gr R");
    expect(matchGrade(grades, "13")).toBeNull();
    expect(matchGrade(grades, "Reception")).toBeNull();
  });
});

describe("ordering", () => {
  it("orders grades by creation time, not by name", () => {
    const ordered = orderGrades([g("Gr 10", 2), g("Gr 2", 1), g("Gr R", 0)]);
    expect(ordered.map((x) => x.name)).toEqual(["Gr R", "Gr 2", "Gr 10"]);
  });

  it("falls back to the preset order when created in the same instant", () => {
    const shuffled = [g("Gr 3"), g("Gr R"), g("Gr 12"), g("Gr 1")];
    expect(orderGrades(shuffled).map((x) => x.name)).toEqual(["Gr R", "Gr 1", "Gr 3", "Gr 12"]);
  });

  it("falls back to the name for non-preset grades created together", () => {
    expect(compareGrades(g("B"), g("A"))).toBeGreaterThan(0);
  });

  it("does not change the list it is given", () => {
    const list = [g("Gr 2", 1), g("Gr 1", 0)];
    orderGrades(list);
    expect(list[0].name).toBe("Gr 2");
  });

  it("accepts ISO strings for createdAt", () => {
    const a = { name: "Gr 1", createdAt: "2026-01-02T00:00:00.000Z" };
    const b = { name: "Gr R", createdAt: "2026-01-01T00:00:00.000Z" };
    expect(orderGrades([a, b]).map((x) => x.name)).toEqual(["Gr R", "Gr 1"]);
  });

  it("staged timestamps keep the typed order", () => {
    const stamps = stagedCreatedAt(3, new Date("2026-01-01T00:00:00.000Z"));
    expect(stamps.map((d) => d.getTime())).toEqual([...stamps.map((d) => d.getTime())].sort((a, b) => a - b));
    expect(new Set(stamps.map((d) => d.getTime())).size).toBe(3);
  });

  it("sorts children by grade order, then surname and first name, ungraded last", () => {
    const rank = gradeRankMap([g("Gr 2", 1), g("Gr 1", 0)]);
    const kids = [
      { subCategoryId: "Gr 2", lastName: "Zulu", firstName: "A" },
      { subCategoryId: null, lastName: "Adams", firstName: "A" },
      { subCategoryId: "Gr 1", lastName: "Nkosi", firstName: "B" },
      { subCategoryId: "Gr 1", lastName: "Nkosi", firstName: "A" },
      { subCategoryId: "Gr 1", lastName: "Dube", firstName: "C" },
    ];
    expect(sortChildrenByGrade(kids, rank).map((k) => `${k.subCategoryId}/${k.lastName}/${k.firstName}`)).toEqual([
      "Gr 1/Dube/C",
      "Gr 1/Nkosi/A",
      "Gr 1/Nkosi/B",
      "Gr 2/Zulu/A",
      "null/Adams/A",
    ]);
  });
});

describe("gradeInfo", () => {
  it("reports the order, whether the class has live grades, and names by id", () => {
    const info = gradeInfo([g("Gr 2", 1), g("Gr 1", 0)]);
    expect(info.ordered.map((x) => x.name)).toEqual(["Gr 1", "Gr 2"]);
    expect(info.hasGrades).toBe(true);
    expect(info.nameById.get("Gr 2")).toBe("Gr 2");
    expect(info.rank.get("Gr 1")).toBe(0);
  });

  it("treats a class with only archived (or no) grades as having none", () => {
    expect(gradeInfo([]).hasGrades).toBe(false);
    expect(gradeInfo([g("Gr 1", 0, true)]).hasGrades).toBe(false);
  });

  it("sorts a register by grade, then first name (registers list by first name)", () => {
    const rank = gradeRankMap([g("Gr 1", 0), g("Gr 2", 1)]);
    const kids = [
      { subCategoryId: "Gr 2", firstName: "Amy", lastName: "Zulu" },
      { subCategoryId: "Gr 1", firstName: "Zola", lastName: "Dube" },
      { subCategoryId: "Gr 1", firstName: "Anele", lastName: "Nkosi" },
    ];
    expect(sortChildrenByGrade(kids, rank, "firstName").map((k) => k.firstName)).toEqual(["Anele", "Zola", "Amy"]);
  });
});

describe("grade name validation", () => {
  it("requires a name", () => {
    expect(gradeNameProblem("  ", [])).toMatch(/required/i);
  });

  it("rejects a duplicate, ignoring case and Gr/Grade wording", () => {
    expect(gradeNameProblem("gr 3", ["Gr 3"])).toMatch(/already/i);
    expect(gradeNameProblem("Grade 3", ["Gr 3"])).toMatch(/already/i);
    expect(gradeNameProblem("Gr 4", ["Gr 3"])).toBeNull();
  });

  it("limits the length", () => {
    expect(gradeNameProblem("x".repeat(61), [])).toMatch(/at most/);
  });

  it("cleans a list: trims, drops blanks, keeps the typed order", () => {
    expect(normaliseGradeList([" Gr R ", "", "Gr  1", "Playgroup"])).toEqual({
      names: ["Gr R", "Gr 1", "Playgroup"],
      problem: null,
    });
  });

  it("reports a duplicate in the list", () => {
    const r = normaliseGradeList(["Gr 1", "Grade 1"]);
    expect(r.problem).toMatch(/already a grade called "Grade 1"/);
  });

  it("checks new names against the grades already in the class", () => {
    expect(normaliseGradeList(["Gr 1"], ["Gr 1"]).problem).toMatch(/already/);
  });

  it("caps the number of grades", () => {
    const many = Array.from({ length: 31 }, (_, i) => `Level ${i + 1}x`);
    expect(normaliseGradeList(many).problem).toMatch(/at most 30/);
  });

  it("accepts the whole preset", () => {
    expect(normaliseGradeList([...GRADE_PRESET])).toEqual({ names: [...GRADE_PRESET], problem: null });
  });
});

describe("assigning a grade to a child", () => {
  const ok = { parentId: "class1", archived: false, deletedAt: null };

  it("accepts a live grade of the child's class", () => {
    expect(gradeAssignmentProblem(ok, "class1")).toBeNull();
  });

  it("rejects an unknown or deleted grade", () => {
    expect(gradeAssignmentProblem(null, "class1")).toMatch(/doesn't exist/);
    expect(gradeAssignmentProblem({ ...ok, deletedAt: new Date() }, "class1")).toMatch(/doesn't exist/);
  });

  it("rejects a grade of another class", () => {
    expect(gradeAssignmentProblem(ok, "class2")).toMatch(/doesn't belong/);
  });

  it("rejects a top-level class used as a grade", () => {
    expect(gradeAssignmentProblem({ ...ok, parentId: null }, "class1")).toMatch(/doesn't belong/);
  });

  it("rejects an archived grade", () => {
    expect(gradeAssignmentProblem({ ...ok, archived: true }, "class1")).toMatch(/archived/);
  });

  it("clears the old grade when the class changes", () => {
    expect(nextSubCategoryId({ current: "g1", requested: undefined, oldClassId: "a", newClassId: "b" })).toBeNull();
  });

  it("keeps the grade when the class stays the same and none was sent", () => {
    expect(nextSubCategoryId({ current: "g1", requested: undefined, oldClassId: "a", newClassId: "a" })).toBeUndefined();
  });

  it("uses a requested grade (or an explicit clear)", () => {
    expect(nextSubCategoryId({ current: "g1", requested: "g2", oldClassId: "a", newClassId: "b" })).toBe("g2");
    expect(nextSubCategoryId({ current: "g1", requested: null, oldClassId: "a", newClassId: "a" })).toBeNull();
  });

  it("leaves a child with no grade alone when the class changes", () => {
    expect(nextSubCategoryId({ current: null, requested: undefined, oldClassId: "a", newClassId: "b" })).toBeUndefined();
  });
});

describe("archiving a grade", () => {
  it("is fine with no children", () => {
    expect(gradeInUseProblem("Gr 3", 0)).toBeNull();
  });

  it("says how many children are still in it", () => {
    expect(gradeInUseProblem("Gr 3", 1)).toMatch(/^1 child is still in Gr 3/);
    expect(gradeInUseProblem("Gr 3", 4)).toMatch(/^4 children are still in Gr 3/);
  });
});

describe("import grade resolution", () => {
  const grades = GRADE_PRESET.map((n, i) => g(n, i));

  it("treats a blank cell as no grade", () => {
    expect(resolveImportGrade("Aftercare", grades, "  ")).toEqual({ grade: null });
  });

  it("matches loosely within the class", () => {
    const r = resolveImportGrade("Aftercare", grades, "grade 7");
    expect(r.grade?.name).toBe("Gr 7");
  });

  it("is a row error for an unknown grade, listing the options", () => {
    const r = resolveImportGrade("Aftercare", grades, "Gr 13");
    expect(r.error).toMatch(/doesn't match any grade in "Aftercare"/);
    expect(r.error).toMatch(/Gr R, Gr 1/);
  });

  it("is a row error for a grade given for a class without grades", () => {
    const r = resolveImportGrade("Ducks", [], "Gr 3");
    expect(r.error).toMatch(/"Ducks" has no grades/);
  });

  it("treats a class whose grades are all archived as having none", () => {
    expect(resolveImportGrade("Ducks", [g("Gr 1", 0, true)], "Gr 1").error).toMatch(/has no grades/);
  });

  it("explains an archived grade", () => {
    const r = resolveImportGrade("Aftercare", [g("Gr 1"), g("Gr 2", 1, true)], "Gr 2");
    expect(r.error).toMatch(/archived/);
  });
});

describe("display", () => {
  it("joins class and grade", () => {
    expect(classLabel("Aftercare", "Gr 3")).toBe("Aftercare · Gr 3");
    expect(classLabel("Ducks", null)).toBe("Ducks");
    expect(classLabel("Ducks")).toBe("Ducks");
  });
});
