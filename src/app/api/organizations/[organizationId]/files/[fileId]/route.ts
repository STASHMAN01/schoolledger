import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { signView } from "@/lib/storage";
import { canView } from "@/lib/storedFiles";

type Params = { params: Promise<{ organizationId: string; fileId: string }> };

// Viewing a stored file. The bucket is private, so this checks the caller
// first and then redirects to a link that stops working after a few minutes.
// Nothing is cached publicly: these are children's photos.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, fileId } = await params;
    const { role, permissions, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");

    const file = await db.storedFile.findFirst({
      where: { id: fileId, organizationId, status: "ACTIVE" },
      select: { key: true, kind: true, contentType: true, classworkEntryId: true, childReportId: true },
    });
    if (!file) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!(await canView(organizationId, file, { role, assignedCategoryId, permissions }))) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    const download = req.nextUrl.searchParams.get("download") === "1";
    const url = await signView(file.key, download ? { downloadName: `crechely-${fileId}` } : {});
    return NextResponse.redirect(url, { status: 307, headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return handleApiError(err);
  }
}
