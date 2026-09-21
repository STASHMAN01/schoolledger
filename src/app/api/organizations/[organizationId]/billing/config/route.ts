import { NextResponse } from "next/server";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string }> };

// Lets the Billing settings page know, before anyone clicks a Subscribe
// button, whether Paystack is actually wired up yet — never exposes the
// key/plan code values themselves, just whether each is present. Used to
// grey out checkout instead of letting an admin click through to a
// confusing "Billing is not configured yet." failure from the checkout
// route itself.
export async function GET(_req: Request, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId, "MANAGE_BILLING", { skipAccessCheck: true });

    const hasSecretKey = Boolean(process.env.PAYSTACK_SECRET_KEY);
    const hasMonthly = Boolean(process.env.PAYSTACK_PLAN_CODE_MONTHLY);
    const hasYearly = Boolean(process.env.PAYSTACK_PLAN_CODE_YEARLY);

    return NextResponse.json({
      monthlyConfigured: hasSecretKey && hasMonthly,
      yearlyConfigured: hasSecretKey && hasYearly,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
