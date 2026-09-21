import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { checkoutSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/apiError";
import { initializeTransaction } from "@/lib/paystack";

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

    const planCode =
      body.plan === "monthly"
        ? process.env.PAYSTACK_PLAN_CODE_MONTHLY
        : process.env.PAYSTACK_PLAN_CODE_YEARLY;
    if (!planCode || !process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        { error: "Billing is not configured yet." },
        { status: 500 }
      );
    }

    const admin = await db.user.findUnique({ where: { id: userId } });
    if (!admin?.email) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const origin = req.nextUrl.origin;
    // No separate "create the customer" call — /transaction/initialize
    // creates (or reuses, matched by email) the Paystack customer itself.
    // We correlate the resulting charge.success webhook back to this
    // organization via metadata, since Paystack has no client_reference_id
    // equivalent.
    const { authorization_url } = await initializeTransaction({
      email: admin.email,
      planCode,
      callbackUrl: `${origin}/dashboard/accounting/settings/billing?checkout=success`,
      metadata: { organizationId, plan: body.plan },
    });

    return NextResponse.json({ url: authorization_url });
  } catch (err) {
    return handleApiError(err);
  }
}
