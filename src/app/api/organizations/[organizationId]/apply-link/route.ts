import { NextRequest, NextResponse } from "next/server";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { applyUrl, getApplyToken, publicBaseUrl, regenerateApplyToken } from "@/lib/applyLink";

type Params = { params: Promise<{ organizationId: string }> };

// The school's permanent apply link, for the Forms page. Same permission
// as reviewing submissions (MANAGE_CHILDREN). A TEACHER can't manage it:
// new families aren't in any class yet.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { role } = await requireMembership(organizationId, "MANAGE_CHILDREN");
    if (role === "TEACHER") return NextResponse.json({ url: null });

    const token = await getApplyToken(organizationId);
    return NextResponse.json({
      url: token ? applyUrl(publicBaseUrl(req.nextUrl.origin), token) : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// Creates the link, or replaces it (the old link stops working at once).
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role } = await requireMembership(organizationId, "MANAGE_CHILDREN");
    if (role === "TEACHER") {
      return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });
    }

    const hadOne = (await getApplyToken(organizationId)) !== null;
    const token = await regenerateApplyToken(organizationId);

    await logAudit({
      organizationId,
      userId,
      action: hadOne ? "applyLink.regenerated" : "applyLink.created",
      entityType: "Child",
    });

    return NextResponse.json({ url: applyUrl(publicBaseUrl(req.nextUrl.origin), token) });
  } catch (err) {
    return handleApiError(err);
  }
}
