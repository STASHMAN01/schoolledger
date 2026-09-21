import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string }> };

// Pending-review list -- the Centre Management "Pending reviews" tile
// links here. A TEACHER only sees submissions for children in their own
// assigned class, same scoping as every other children/* endpoint; a
// RECEPTIONIST/MANAGER/ADMIN with MANAGE_CHILDREN sees the whole org.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { role, assignedCategoryId } = await requireMembership(
      organizationId,
      "MANAGE_CHILDREN"
    );

    const statusParam = req.nextUrl.searchParams.get("status");
    const status = statusParam === "APPROVED" || statusParam === "REJECTED" ? statusParam : "PENDING";

    const submissions = await db.parentSubmission.findMany({
      where: {
        organizationId,
        status,
        ...(role === "TEACHER"
          ? { link: { child: { categoryId: assignedCategoryId ?? "__none__" } } }
          : {}),
      },
      orderBy: { submittedAt: "desc" },
      include: {
        link: { include: { child: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });

    return NextResponse.json({
      submissions: submissions.map((s) => ({
        id: s.id,
        status: s.status,
        submittedAt: s.submittedAt,
        child: s.link.child,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
