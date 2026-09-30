import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { decodeDataUrl, documentLabel } from "@/lib/documents";

type Params = { params: Promise<{ organizationId: string; documentId: string }> };

// Open one document (a child's, or one a parent uploaded with an online
// form that is waiting for review). Opens in the browser; ?download=1
// saves it instead.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, documentId } = await params;
    const { role, assignedCategoryId, permissions } = await requireMembership(organizationId);
    const doc = await db.childDocument.findFirst({
      where: { id: documentId, organizationId },
      select: {
        type: true,
        fileName: true,
        fileData: true,
        childId: true,
        child: { select: { categoryId: true, firstName: true, lastName: true } },
        submission: { select: { link: { select: { child: { select: { categoryId: true } } } } } },
      },
    });
    if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (doc.child) {
      if (role === "TEACHER" && doc.child.categoryId !== assignedCategoryId) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
    } else {
      // Not yet on a child (an online form waiting for review): only people
      // who review forms, and a TEACHER only for a child in their own class
      // -- never a new family's application (same rule as the review page).
      const linkClass = doc.submission?.link?.child.categoryId ?? null;
      if (
        !permissions.includes("MANAGE_CHILDREN") ||
        (role === "TEACHER" && (!linkClass || linkClass !== assignedCategoryId))
      ) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
    }
    const decoded = decodeDataUrl(doc.fileData);
    if (!decoded) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const ext = decoded.contentType === "application/pdf" ? "pdf" : decoded.contentType.split("/")[1] ?? "jpg";
    const who = doc.child ? `${doc.child.firstName} ${doc.child.lastName} - ` : "";
    const name = `${who}${documentLabel(doc.type)}.${ext}`.replace(/[^\w .()-]/g, "");
    const disposition = req.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";

    return new NextResponse(new Uint8Array(decoded.bytes), {
      headers: {
        "Content-Type": decoded.contentType,
        "Content-Disposition": `${disposition}; filename="${name}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        // Uploaded by parents: never let a file run anything on our domain.
        // (Only photos and PDFs are ever accepted; a sandbox would stop the
        // browser's own PDF viewer, so it's applied to photos only.)
        ...(decoded.contentType === "application/pdf" ? {} : { "Content-Security-Policy": "sandbox" }),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
