import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { testimonialSubmissionSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/apiError";

// Public, unauthenticated submission endpoint for the homepage "Give a
// testimonial" flow. Nothing submitted here appears anywhere on the site
// until a platform admin approves it in /platform/testimonials — see
// CRECHELY_AUDIT.md's rule against ever inventing or auto-publishing proof.
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req.headers);
    const { allowed } = rateLimit(`testimonial-submit-ip:${ip}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many submissions. Try again later." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = testimonialSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    // Honeypot tripped — pretend success so a bot doesn't learn to leave
    // this field alone; nothing is actually written.
    if (parsed.data.website) {
      return NextResponse.json({ ok: true });
    }

    await db.testimonial.create({
      data: {
        authorName: parsed.data.authorName,
        schoolName: parsed.data.schoolName || null,
        quote: parsed.data.quote,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
