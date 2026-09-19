import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { handleApiError } from "@/lib/apiError";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ testimonialId: string }> }
) {
  try {
    const { userId } = await requirePlatformAdmin();
    const { testimonialId } = await params;

    const testimonial = await db.testimonial.update({
      where: { id: testimonialId },
      data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: userId },
    });

    return NextResponse.json({ testimonial });
  } catch (err) {
    return handleApiError(err);
  }
}
