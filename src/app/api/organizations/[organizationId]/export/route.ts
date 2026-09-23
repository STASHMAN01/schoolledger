import { NextRequest, NextResponse } from "next/server";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { buildOrgBackupZip } from "@/lib/backup/exportOrg";
import { backupFilename } from "@/lib/backup/helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ organizationId: string }> };

// Full data backup (Phase 4). POST rather than GET so a link, prefetch or
// crawler can never trigger a bulk export of children's data. The ZIP's
// password is generated per download, returned once in a header, and
// never stored anywhere.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId } = await requireMembership(organizationId, "EXPORT_DATA");

    const { zipBuffer, password, counts, schoolName } = await buildOrgBackupZip(organizationId);

    // Only logged once the backup actually built.
    await logAudit({
      organizationId,
      userId,
      action: "export.downloaded",
      entityType: "Export",
      metadata: counts,
    });

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${backupFilename(schoolName)}"`,
        "X-Export-Password": password,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
