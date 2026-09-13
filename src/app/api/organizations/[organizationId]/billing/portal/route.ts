import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { getStripe } from "@/lib/stripe";

type Params = { params: Promise<{ organizationId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId, ["ADMIN"], { skipAccessCheck: true });

    const organization = await db.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account yet — subscribe first." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const origin = req.nextUrl.origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: `${origin}/dashboard/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return handleApiError(err);
  }
}
