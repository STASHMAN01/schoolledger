import { describe, expect, it } from "vitest";
import { orgApiSubpath, teacherMayCall, teacherMayOpen } from "./teacherAccess";
import { getEffectivePermissions, ALL_PERMISSIONS } from "./permissions";
import { serializeChildForTeacher } from "./childView";

const api = (sub: string) => `/api/organizations/cl0rg123${sub}`;

describe("teacherMayCall", () => {
  it("allows the teacher's own jobs", () => {
    expect(teacherMayCall("GET", api("/children"))).toBe(true);
    expect(teacherMayCall("GET", api("/children/abc123"))).toBe(true);
    expect(teacherMayCall("GET", api("/attendance/register"))).toBe(true);
    expect(teacherMayCall("POST", api("/attendance/register"))).toBe(true);
    expect(teacherMayCall("GET", api("/schedule"))).toBe(true);
    expect(teacherMayCall("POST", api("/reports"))).toBe(true);
    expect(teacherMayCall("GET", api("/reports/r1/pdf"))).toBe(true);
    expect(teacherMayCall("GET", api("/todos"))).toBe(true);
    expect(teacherMayCall("HEAD", api("/events/upcoming"))).toBe(true);
    expect(teacherMayCall("GET", api("/daily-summary"))).toBe(true);
    expect(teacherMayCall("POST", api("/daily-summary"))).toBe(true);
    expect(teacherMayCall("GET", api("/lesson-plans"))).toBe(true);
    expect(teacherMayCall("POST", api("/lesson-plans/submit"))).toBe(true);
    expect(teacherMayCall("GET", api("/classwork"))).toBe(true);
    expect(teacherMayCall("POST", api("/classwork"))).toBe(true);
    expect(teacherMayCall("GET", api("/tasks"))).toBe(true);
    expect(teacherMayCall("POST", api("/tasks/abc/acknowledge"))).toBe(true);
    expect(teacherMayCall("POST", api("/tasks/abc/complete"))).toBe(true);
    expect(teacherMayCall("GET", api("/medicine"))).toBe(true);
    expect(teacherMayCall("POST", api("/medicine"))).toBe(true);
    expect(teacherMayCall("POST", api("/medicine/abc/sign"))).toBe(true);
    expect(teacherMayCall("POST", api("/medicine/abc/dose"))).toBe(true);
    expect(teacherMayCall("POST", api("/medicine/abc/return"))).toBe(true);
    expect(teacherMayCall("GET", api("/medicine/abc/pdf"))).toBe(true);
  });

  it("lets a teacher upload, confirm, remove and view photos, but not browse the Files page", () => {
    expect(teacherMayCall("POST", api("/uploads"))).toBe(true);
    expect(teacherMayCall("PUT", api("/uploads/f1"))).toBe(true);
    expect(teacherMayCall("DELETE", api("/uploads/f1"))).toBe(true);
    expect(teacherMayCall("GET", api("/files/f1"))).toBe(true);
    expect(teacherMayCall("GET", api("/files"))).toBe(false);
  });

  it("refuses changes, parent data and admin areas", () => {
    expect(teacherMayCall("PATCH", api("/children/abc123"))).toBe(false);
    expect(teacherMayCall("DELETE", api("/reports/r1"))).toBe(false);
    expect(teacherMayCall("PATCH", api("/reports/r1"))).toBe(false);
    expect(teacherMayCall("POST", api("/children"))).toBe(false);
    expect(teacherMayCall("GET", api("/children/abc123/guardians"))).toBe(false);
    expect(teacherMayCall("GET", api("/children/abc123/forms"))).toBe(false);
    expect(teacherMayCall("GET", api("/parent-submissions"))).toBe(false);
    expect(teacherMayCall("GET", api("/documents/missing"))).toBe(false);
    expect(teacherMayCall("GET", api("/files"))).toBe(false);
    expect(teacherMayCall("GET", api("/attendance/absent"))).toBe(false);
    expect(teacherMayCall("POST", api("/attendance/notify"))).toBe(false);
    expect(teacherMayCall("PUT", api("/schedule"))).toBe(false);
    expect(teacherMayCall("GET", api(""))).toBe(false); // school profile
    expect(teacherMayCall("GET", api("/staff"))).toBe(false);
    expect(teacherMayCall("GET", api("/audit"))).toBe(false);
    expect(teacherMayCall("PATCH", api("/daily-summary"))).toBe(false);
    // Lesson plans are written by the admin; classwork is add-only.
    expect(teacherMayCall("PUT", api("/lesson-plans"))).toBe(false);
    expect(teacherMayCall("GET", api("/lesson-plans/pending"))).toBe(false);
    expect(teacherMayCall("POST", api("/lesson-plans/review"))).toBe(false);
    expect(teacherMayCall("DELETE", api("/classwork/abc123"))).toBe(false);
    expect(teacherMayCall("PATCH", api("/classwork/abc123"))).toBe(false);
    // Only an admin hands out or takes back tasks.
    expect(teacherMayCall("POST", api("/tasks"))).toBe(false);
    expect(teacherMayCall("DELETE", api("/tasks/abc"))).toBe(false);
    expect(teacherMayCall("DELETE", api("/medicine/abc"))).toBe(false);
    expect(teacherMayCall("GET", api("/lesson-themes"))).toBe(false);
    expect(teacherMayCall("POST", api("/lesson-themes"))).toBe(false);
    expect(teacherMayCall("PATCH", api("/lesson-themes/abc"))).toBe(false);
    expect(teacherMayCall("POST", api("/lesson-plans/import"))).toBe(false);
    expect(teacherMayCall("PUT", api("/medicine/abc"))).toBe(false);
  });

  it("ignores query strings and trailing slashes", () => {
    expect(teacherMayCall("GET", api("/reports?type=ACADEMIC"))).toBe(true);
    expect(teacherMayCall("GET", api("/children/"))).toBe(true);
  });

  it("only judges organization API paths", () => {
    expect(orgApiSubpath("/dashboard/centre")).toBeNull();
    expect(teacherMayCall("GET", "/dashboard/centre")).toBe(true);
  });
});

describe("teacherMayOpen", () => {
  it("lets teachers open their pages", () => {
    for (const p of [
      "/dashboard",
      "/dashboard/centre",
      "/dashboard/centre/enrolled",
      "/dashboard/centre/children/abc",
      "/dashboard/centre/attendance",
      "/dashboard/centre/reports",
      "/dashboard/centre/schedule",
      "/dashboard/centre/events",
      "/dashboard/centre/daily-summary",
      "/dashboard/centre/lesson-plan",
      "/dashboard/centre/classwork",
      "/dashboard/centre/tasks",
    ]) {
      expect(teacherMayOpen(p)).toBe(true);
    }
  });

  it("keeps teachers out of admin pages", () => {
    for (const p of [
      "/dashboard/centre/forms",
      "/dashboard/centre/admissions",
      "/dashboard/centre/documents",
      "/dashboard/centre/files",
      "/dashboard/centre/classes",
      "/dashboard/centre/staff",
      "/dashboard/centre/communication",
      "/dashboard/centre/settings/general",
      "/dashboard/centre/attendance/absent",
      "/dashboard/centre/pending-reviews/x",
    ]) {
      expect(teacherMayOpen(p)).toBe(false);
    }
  });
});

describe("Teacher permission ceiling", () => {
  it("never goes beyond register, routine and reports, whatever overrides say", () => {
    const everything = ALL_PERMISSIONS.map((permission) => ({ permission, granted: true }));
    expect(getEffectivePermissions("TEACHER", everything).sort()).toEqual(
      ["MANAGE_ATTENDANCE", "MANAGE_REPORTS", "VIEW_CENTRE"].sort()
    );
  });
});

describe("serializeChildForTeacher", () => {
  it("sends only name, class, gender, age, allergies and emergency contact", () => {
    const full = {
      id: "c1",
      organizationId: "o1",
      categoryId: "k1",
      category: { id: "k1", name: "Fish", monthlyFeeCents: 140000 },
      firstName: "Test",
      lastName: "Child",
      parentName: "Secret Parent",
      parentPhone: "+27820000000",
      parentEmail: "p@example.com",
      childIdNumber: "0000000000000",
      parentIdNumber: "0000000000000",
      homeAddress: "1 Hidden Street",
      photoImage: "data:image/png;base64,xx",
      feeOverrideCents: 100,
      dateOfBirth: new Date("2022-01-01"),
      gender: "FEMALE",
      allergies: "Peanuts",
      emergencyContactName: "Gran",
      emergencyContactRelationship: "Grandmother",
      emergencyContactPhone: "+27830000000",
      enrollmentDate: new Date("2026-01-01"),
      exitDate: null,
      archived: false,
    };
    const out = serializeChildForTeacher(full) as Record<string, unknown>;
    const text = JSON.stringify(out);
    for (const secret of ["Secret Parent", "+27820000000", "p@example.com", "Hidden Street", "base64", "140000"]) {
      expect(text).not.toContain(secret);
    }
    expect(out.allergies).toBe("Peanuts");
    expect(out.gender).toBe("FEMALE");
    expect(out.emergencyContactPhone).toBe("+27830000000");
  });
});
