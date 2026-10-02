import { NextRequest, NextResponse } from "next/server";
import type { FormType, ReportType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { FORM_TYPE_LABELS } from "@/lib/forms/types";
import { REPORT_TYPE_INFO } from "@/lib/reports";
import {
  FOLDERS,
  MODE_PERMISSION,
  canSeeFolder,
  dayMonthYear,
  isFilesMode,
  isFolderKey,
  isMonthKey,
  monthKeyOf,
  monthKeyOfDateOnly,
  monthLabel,
  monthRange,
  monthYear,
  pluralise,
  sortMonthsDesc,
  statementDisplayName,
  visibleFolders,
  withDownload,
  type ChildEntry,
  type FileEntry,
  type FilesResponse,
  type FolderKey,
} from "@/lib/files";

type Params = { params: Promise<{ organizationId: string }> };

// The Files section's one read endpoint (Accounting and Centre both use
// it). It walks the folder tree one level per request:
//
//   (nothing)                          -> the folders this person may open
//   ?folder=statements                 -> the months that have anything
//   ?folder=statements&month=2026-09   -> the classes, with a count each
//   ...&classId=<id>                   -> the children / files in that class
//
// Everything is derived from data the app already keeps. Statements are
// not stored (they're generated on demand), so the Statements folder is
// built from the "statement.generated" audit entries: opening a statement
// from Files generates a fresh one from today's figures, exactly as the
// child's own page does.
//
// Permissions mirror the pages the documents come from (see FOLDERS in
// src/lib/files.ts), and a TEACHER only ever sees their own class.

const FORM_FOLDER: Partial<Record<FolderKey, FormType>> = {
  enrolment: "ENROLMENT",
  "re-registration": "RE_REGISTRATION",
};
const REPORT_FOLDER: Partial<Record<FolderKey, ReportType>> = {
  academic: "ACADEMIC",
  incident: "INCIDENT",
  disciplinary: "DISCIPLINARY",
};

// One document, before it's dressed up as a FileEntry.
type Doc = {
  id: string;
  childId: string;
  classId: string;
  firstName: string;
  lastName: string;
  at: Date;
  // statements only
  year?: number;
  joint?: boolean;
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const sp = req.nextUrl.searchParams;

    const mode = sp.get("mode");
    if (!isFilesMode(mode)) {
      return NextResponse.json({ error: "mode must be accounting or centre." }, { status: 400 });
    }
    const { role, permissions, assignedCategoryId } = await requireMembership(
      organizationId,
      MODE_PERMISSION[mode]
    );

    const folderParam = sp.get("folder");
    if (!folderParam) {
      const folders = visibleFolders(mode, permissions).map((key) => ({
        key,
        label: FOLDERS[key].label,
        hint: FOLDERS[key].hint,
      }));
      const body: FilesResponse = { level: "root", folders };
      return NextResponse.json(body);
    }

    // A folder this person can't see is "not found", the same as one that
    // doesn't exist.
    if (!isFolderKey(folderParam) || !canSeeFolder(folderParam, mode, permissions)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const folder: FolderKey = folderParam;
    const folderInfo = { key: folder, label: FOLDERS[folder].label };

    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { timezone: true },
    });
    if (!org) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const tz = org.timezone || "Africa/Johannesburg";

    // The classes this person may look into. A TEACHER gets only their
    // own (none, if they haven't been given one yet).
    const classRows = await db.category.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(role === "TEACHER" ? { id: assignedCategoryId ?? "__none__" } : {}),
      },
      select: { id: true, name: true, archived: true },
      orderBy: { name: "asc" },
    });
    const classes = classRows.map((c) => ({ id: c.id, name: c.archived ? `${c.name} (archived)` : c.name }));
    const classIds = classes.map((c) => c.id);

    const monthParam = sp.get("month");
    const classParam = sp.get("classId");

    // -------------------------------------------------- months level
    if (!monthParam) {
      const keys = await monthsWithFiles(folder, organizationId, classIds, tz);
      if (folder === "statements") keys.push(monthKeyOf(new Date(), tz));
      const months = sortMonthsDesc(keys).map((key) => ({ key, label: monthLabel(key) }));
      const body: FilesResponse = { level: "months", folder: folderInfo, months };
      return NextResponse.json(body);
    }

    if (!isMonthKey(monthParam)) {
      return NextResponse.json({ error: "Invalid month." }, { status: 400 });
    }
    const month = { key: monthParam, label: monthLabel(monthParam) };
    const range = monthRange(monthParam, folder === "attendance" ? "UTC" : tz);

    // ------------------------------------------------- classes level
    if (!classParam) {
      let summaries: Map<string, string>;
      if (folder === "attendance") {
        summaries = new Map(classes.map((c) => [c.id, "Monthly register"]));
      } else {
        const docs = await loadDocs(folder, organizationId, classIds, range);
        const byClass = new Map<string, Set<string>>();
        for (const d of docs) {
          const set = byClass.get(d.classId) ?? new Set<string>();
          set.add(folder === "statements" ? d.childId : d.id);
          byClass.set(d.classId, set);
        }
        summaries = new Map();
        if (folder === "statements") {
          const totals = await db.child.groupBy({
            by: ["categoryId"],
            where: { organizationId, deletedAt: null, archived: false, categoryId: { in: classIds } },
            _count: { _all: true },
          });
          const totalByClass = new Map(totals.map((t) => [t.categoryId, t._count._all]));
          for (const c of classes) {
            const generated = byClass.get(c.id)?.size ?? 0;
            const total = Math.max(totalByClass.get(c.id) ?? 0, generated);
            summaries.set(c.id, total === 0 ? "No children" : `${generated} of ${total} generated`);
          }
        } else {
          const noun = nounFor(folder);
          for (const c of classes) {
            const n = byClass.get(c.id)?.size ?? 0;
            summaries.set(c.id, n === 0 ? "Nothing yet" : pluralise(n, noun));
          }
        }
      }
      const body: FilesResponse = {
        level: "classes",
        folder: folderInfo,
        month,
        classes: classes.map((c) => ({ id: c.id, name: c.name, summary: summaries.get(c.id) ?? "" })),
      };
      return NextResponse.json(body);
    }

    // --------------------------------------------------- class level
    const cls = classes.find((c) => c.id === classParam);
    if (!cls) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const apiBase = `/api/organizations/${organizationId}`;
    let children: ChildEntry[] = [];
    let files: FileEntry[] = [];

    if (folder === "attendance") {
      const days = await db.attendanceRecord.groupBy({
        by: ["date"],
        where: {
          organizationId,
          child: { categoryId: cls.id },
          date: { gte: range.start, lt: range.end },
        },
      });
      const href = `${apiBase}/attendance/register/pdf?categoryId=${encodeURIComponent(cls.id)}&month=${month.key}`;
      files = [
        {
          id: `${cls.id}:${month.key}`,
          name: `${cls.name} ${month.label} register`,
          detail: days.length === 0 ? "No days recorded yet" : pluralise(days.length, "day") + " recorded",
          href,
          downloadHref: withDownload(href),
        },
      ];
    } else {
      const docs = (await loadDocs(folder, organizationId, [cls.id], range)).filter(
        (d) => d.classId === cls.id
      );
      const docsByChild = new Map<string, Doc[]>();
      for (const d of docs) {
        const list = docsByChild.get(d.childId) ?? [];
        list.push(d);
        docsByChild.set(d.childId, list);
      }

      if (folder === "statements") {
        // Every child in the class, so "not generated yet" is visible too.
        const kids = await db.child.findMany({
          where: {
            organizationId,
            categoryId: cls.id,
            deletedAt: null,
            OR: [{ archived: false }, { id: { in: [...docsByChild.keys()] } }],
          },
          select: { id: true, firstName: true, lastName: true },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        });
        children = kids.map((k) => {
          const mine = docsByChild.get(k.id) ?? [];
          const latest = mine.sort((a, b) => b.at.getTime() - a.at.getTime())[0];
          const entry: ChildEntry = {
            id: k.id,
            name: `${k.firstName} ${k.lastName}`,
            files: [],
            emptyText: "No statement generated",
          };
          if (latest) {
            const href = `${apiBase}/children/${k.id}/statement?year=${latest.year ?? monthYear(month.key)}`;
            entry.files = [
              {
                id: latest.id,
                name: statementDisplayName(k.firstName, month.key),
                detail: `${latest.joint ? "Joint statement, generated" : "Generated"} ${dayMonthYear(latest.at, tz)}`,
                href,
                downloadHref: withDownload(href),
              },
            ];
          }
          return entry;
        });
      } else {
        const label = fileLabel(folder);
        const ordered = [...docsByChild.values()].sort((a, b) =>
          `${a[0].firstName} ${a[0].lastName}`.localeCompare(`${b[0].firstName} ${b[0].lastName}`)
        );
        children = ordered.map((list) => {
          list.sort((a, b) => b.at.getTime() - a.at.getTime());
          return {
            id: list[0].childId,
            name: `${list[0].firstName} ${list[0].lastName}`,
            emptyText: "",
            files: list.map((d) => {
              const href = documentHref(folder, apiBase, d);
              return {
                id: d.id,
                name: `${d.firstName} ${label}`,
                detail: dayMonthYear(d.at, tz),
                href,
                downloadHref: withDownload(href),
              };
            }),
          };
        });
      }
    }

    const body: FilesResponse = {
      level: "class",
      folder: folderInfo,
      month,
      className: cls.name,
      children,
      files,
    };
    return NextResponse.json(body);
  } catch (err) {
    return handleApiError(err);
  }
}

function nounFor(folder: FolderKey): string {
  if (folder in FORM_FOLDER) return "form";
  return "report";
}

// "Enrolment form", "Incident report", ... used in a file's display name.
function fileLabel(folder: FolderKey): string {
  const formType = FORM_FOLDER[folder];
  if (formType) return FORM_TYPE_LABELS[formType].toLowerCase();
  const reportType = REPORT_FOLDER[folder];
  if (reportType) return REPORT_TYPE_INFO[reportType].label.toLowerCase();
  return "document";
}

function documentHref(folder: FolderKey, apiBase: string, d: Doc): string {
  if (FORM_FOLDER[folder]) return `${apiBase}/children/${d.childId}/forms/${d.id}/download`;
  return `${apiBase}/reports/${d.id}/pdf`;
}

// "YYYY-MM" keys of every month that has at least one document in the
// folder, within the classes this person can see.
async function monthsWithFiles(
  folder: FolderKey,
  organizationId: string,
  classIds: string[],
  tz: string
): Promise<string[]> {
  const formType = FORM_FOLDER[folder];
  if (formType) {
    const rows = await db.formDocument.findMany({
      where: { organizationId, formType, child: { categoryId: { in: classIds }, deletedAt: null } },
      select: { generatedAt: true },
    });
    return rows.map((r) => monthKeyOf(r.generatedAt, tz));
  }
  const reportType = REPORT_FOLDER[folder];
  if (reportType) {
    const rows = await db.childReport.findMany({
      where: { organizationId, type: reportType, categoryId: { in: classIds }, child: { deletedAt: null } },
      select: { occurredAt: true },
    });
    return rows.map((r) => monthKeyOf(r.occurredAt, tz));
  }
  if (folder === "attendance") {
    const rows = await db.attendanceRecord.groupBy({
      by: ["date"],
      where: { organizationId, child: { categoryId: { in: classIds } } },
    });
    return rows.map((r) => monthKeyOfDateOnly(r.date));
  }
  // statements
  const rows = await db.auditLog.findMany({
    where: { organizationId, action: "statement.generated" },
    select: { createdAt: true },
  });
  return rows.map((r) => monthKeyOf(r.createdAt, tz));
}

// Every document in the folder for one month, limited to `classIds`.
// Deliberately selects only what the list needs: a FormDocument row holds
// the whole PDF as text and must never be pulled in just to list it.
async function loadDocs(
  folder: FolderKey,
  organizationId: string,
  classIds: string[],
  range: { start: Date; end: Date }
): Promise<Doc[]> {
  const formType = FORM_FOLDER[folder];
  if (formType) {
    const rows = await db.formDocument.findMany({
      where: {
        organizationId,
        formType,
        generatedAt: { gte: range.start, lt: range.end },
        child: { categoryId: { in: classIds }, deletedAt: null },
      },
      select: {
        id: true,
        childId: true,
        generatedAt: true,
        child: { select: { firstName: true, lastName: true, categoryId: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      childId: r.childId,
      classId: r.child.categoryId,
      firstName: r.child.firstName,
      lastName: r.child.lastName,
      at: r.generatedAt,
    }));
  }

  const reportType = REPORT_FOLDER[folder];
  if (reportType) {
    const rows = await db.childReport.findMany({
      where: {
        organizationId,
        type: reportType,
        categoryId: { in: classIds },
        occurredAt: { gte: range.start, lt: range.end },
        child: { deletedAt: null },
      },
      select: {
        id: true,
        childId: true,
        categoryId: true,
        occurredAt: true,
        child: { select: { firstName: true, lastName: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      childId: r.childId,
      classId: r.categoryId,
      firstName: r.child.firstName,
      lastName: r.child.lastName,
      at: r.occurredAt,
    }));
  }

  // statements: one Doc per child per "statement.generated" audit entry,
  // including siblings named on a joint statement.
  const logs = await db.auditLog.findMany({
    where: {
      organizationId,
      action: "statement.generated",
      createdAt: { gte: range.start, lt: range.end },
    },
    select: { id: true, entityId: true, createdAt: true, metadata: true },
    orderBy: { createdAt: "desc" },
  });
  const hits: { logId: string; childId: string; at: Date; year?: number; joint: boolean }[] = [];
  for (const log of logs) {
    const meta = (log.metadata ?? {}) as { year?: unknown; jointWith?: unknown };
    const year = typeof meta.year === "number" ? meta.year : undefined;
    const joint = Array.isArray(meta.jointWith) && meta.jointWith.length > 0;
    if (log.entityId) hits.push({ logId: log.id, childId: log.entityId, at: log.createdAt, year, joint });
    if (Array.isArray(meta.jointWith)) {
      for (const sib of meta.jointWith) {
        if (typeof sib === "string") hits.push({ logId: log.id, childId: sib, at: log.createdAt, year, joint: true });
      }
    }
  }
  if (hits.length === 0) return [];
  const kids = await db.child.findMany({
    where: {
      organizationId,
      id: { in: [...new Set(hits.map((h) => h.childId))] },
      categoryId: { in: classIds },
      deletedAt: null,
    },
    select: { id: true, firstName: true, lastName: true, categoryId: true },
  });
  const kidById = new Map(kids.map((k) => [k.id, k]));
  const docs: Doc[] = [];
  for (const h of hits) {
    const k = kidById.get(h.childId);
    if (!k) continue;
    docs.push({
      id: h.logId,
      childId: k.id,
      classId: k.categoryId,
      firstName: k.firstName,
      lastName: k.lastName,
      at: h.at,
      year: h.year,
      joint: h.joint,
    });
  }
  return docs;
}
