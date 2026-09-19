import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { handleApiError } from "@/lib/apiError";

// Every submitted testimonial (pending, approved, and rejected), for the
// /platform/testimonials moderation queue. Platform-admin only — see
// src/lib/platformAdmin.ts.
export async function GET() {
  try {
    await requirePlatformAdmin();

    const testimonials = await db.testimonial.findMany({
      orderBy: { createdAt: "desc" },
      include: { reviewedBy: { select: { name: true, email: true } } },
    });

    return NextResponse.json({ testimonials });
  } catch (err) {
    return handleApiError(err);
  }
}
