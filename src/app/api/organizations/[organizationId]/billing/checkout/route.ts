import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { checkoutSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/apiError";
import { getStripe } from "@/lib/stripe";

type Params = { params: Promise<{ organizationId: string }> };

// Billing is deliberately ADMIN-only — the same person who can invite/
// remove users and see everything is the one who can change what the
// school pays, never a MANAGER or ACCOUNTANT (per the original role spec).
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId } = await requireMembership(organizationId, ["ADMIN"], {
      skipAccessCheck: true,
    });

    const body = checkoutSchema.parse(await req.json());

    const organization = await db.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const priceId =
      body.plan === "monthly"
        ? process.env.STRIPE_PRICE_ID_MONTHLY
        : process.env.STRIPE_PRICE_ID_YEARLY;
    if (!priceId) {
      return NextResponse.json(
        { error: "Billing is not configured yet." },
        { status: 500 }
      );
    }

    const stripe = getStripe();
    const admin = await db.user.findUnique({ where: { id: userId } });

    let stripeCustomerId = organization.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: organization.name,
        email: admin?.email,
        metadata: { organizationId },
      });
      stripeCustomerId = customer.id;
      await db.organization.update({
        where: { id: organizationId },
        data: { stripeCustomerId },
      });
    }

    const origin = req.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      client_reference_id: organizationId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { organizationId } },
      allow_promotion_codes: true,
      success_url: `${origin}/dashboard/settings/billing?checkout=success`,
      cancel_url: `${origin}/dashboard/settings/billing?checkout=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return handleApiError(err);
  }
}
