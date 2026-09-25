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
// password is generated per download and never stored anywhere. Returned
// as JSON (password + base64 zip) rather than a response header + binary
// body — a custom response header is more likely to be captured by
// intermediate logging/observability tooling than a JSON body field, and
// this is the one place in the app a raw, usable secret leaves the server.
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

    return NextResponse.json(
      {
        password,
        filename: backupFilename(schoolName),
        zipBase64: zipBuffer.toString("base64"),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
