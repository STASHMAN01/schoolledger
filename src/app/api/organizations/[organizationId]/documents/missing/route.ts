import { NextRequest, NextResponse } from "next/server";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { childrenMissingDocuments } from "@/lib/childDocuments";

type Params = { params: Promise<{ organizationId: string }> };

// Children still missing required documents (Centre dashboard tile and the
// Missing documents page). A TEACHER only sees their own class.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { role, assignedCategoryId } = await requireMembership(organizationId);
    if (role === "TEACHER" && !assignedCategoryId) {
      return NextResponse.json({ required: [], children: [] });
    }
    const result = await childrenMissingDocuments(organizationId, {
      categoryId: role === "TEACHER" ? assignedCategoryId : null,
    });
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
