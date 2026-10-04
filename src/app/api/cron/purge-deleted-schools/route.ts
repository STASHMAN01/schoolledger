import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredOrganizations } from "@/lib/orgDeletion";
import { purgeAbandonedUploads } from "@/lib/childDocuments";
import { purgeExpiredTrash } from "@/lib/trashPurge";

// Daily (vercel.json "crons"). Vercel sends `Authorization: Bearer
// <CRON_SECRET>` when the CRON_SECRET env var is set; anything without it
// is refused, so this can't be triggered by a stranger hitting the URL.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await purgeExpiredOrganizations();
  // Documents parents uploaded in an online form they never submitted.
  const abandonedUploads = await purgeAbandonedUploads().catch(() => -1);
  // Classes and children past their 30 days in Trash, every school.
  const trashPurged = await purgeExpiredTrash().catch(() => -1);
  return NextResponse.json({ ...result, abandonedUploads, trashPurged }, { status: result.failed.length > 0 ? 500 : 200 });
}
