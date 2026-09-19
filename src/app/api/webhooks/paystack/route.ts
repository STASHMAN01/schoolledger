import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

// Paystack webhooks are the one endpoint in this app that's intentionally
// unauthenticated (no session, no membership check) — see PUBLIC_PATHS in
// src/middleware.ts, which already covers this by matching the
// "/api/webhooks" prefix. That's only safe because every request is
// verified against PAYSTACK_SECRET_KEY below: without a valid signature,
// nothing past that point ever runs. Never relax or remove the signature
// check to "make testing easier" — that would let anyone POST arbitrary
// subscription state for any organization.
//
// Signature scheme (different from Stripe's stripe-signature header):
// x-paystack-signature is HMAC-SHA512 of the raw request body, keyed with
// the Paystack secret key, hex-encoded. See
// https://paystack.com/docs/payments/webhooks/#verifying-webhook-signature
export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-paystack-signature");
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!signature || !secretKey) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const rawBody = await req.text();
  const expectedSignature = crypto
    .createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");

  if (
    expectedSignature.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))
  ) {
    console.error("Paystack webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: { event: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    switch (event.event) {
      // First successful charge on a brand-new subscription checkout. This
      // is the only event that carries the metadata we set in
      // initializeTransaction (organizationId), so it's the point where we
      // learn which organization this Paystack customer belongs to.
      case "charge.success": {
        const data = event.data as {
          metadata?: { organizationId?: string };
          customer?: { customer_code?: string };
        };
        const organizationId = data.metadata?.organizationId;
        const customerCode = data.customer?.customer_code;
        if (organizationId && customerCode) {
          await db.organization.update({
            where: { id: organizationId },
            data: { paystackCustomerCode: customerCode },
          });
        }
        break;
      }

      // Fires right after the first charge.success for a subscription
      // plan. This is the ONLY place the subscription code + email_token
      // are ever handed to us — both are required later to cancel (see
      // src/lib/paystack.ts) — so they must be captured here, not derived
      // or refetched anywhere else. Correlated to an organization via the
      // customer code charge.success just stored, since this event has no
      // metadata of its own.
      case "subscription.create": {
        const data = event.data as {
          subscription_code?: string;
          email_token?: string;
          next_payment_date?: string;
          status?: string;
          plan?: { plan_code?: string };
          customer?: { customer_code?: string };
        };
        const customerCode = data.customer?.customer_code;
        if (customerCode && data.subscription_code && data.email_token) {
          const organization = await db.organization.findUnique({
            where: { paystackCustomerCode: customerCode },
          });
          if (organization) {
            await db.organization.update({
              where: { id: organization.id },
              data: {
                paystackSubscriptionCode: data.subscription_code,
                paystackEmailToken: data.email_token,
                paystackPlanCode: data.plan?.plan_code ?? organization.paystackPlanCode,
                subscriptionStatus: data.status === "active" ? "active" : "incomplete",
                currentPeriodEnd: data.next_payment_date
                  ? new Date(data.next_payment_date)
                  : null,
              },
            });
            await logAudit({
              organizationId: organization.id,
              action: "billing.subscriptionCreated",
              entityType: "Organization",
              entityId: organization.id,
            });
          }
        }
        break;
      }

      // Subscription was cancelled — either via our own /billing/cancel
      // route or directly in the Paystack dashboard. Access is left alone
      // here (currentPeriodEnd still governs it); this just stops treating
      // the org as an active payer going forward.
      case "subscription.disable": {
        const data = event.data as { subscription_code?: string };
        if (data.subscription_code) {
          const organization = await db.organization.findUnique({
            where: { paystackSubscriptionCode: data.subscription_code },
          });
          if (organization) {
            await db.organization.update({
              where: { id: organization.id },
              data: { subscriptionStatus: "canceled" },
            });
            await logAudit({
              organizationId: organization.id,
              action: "billing.subscriptionCancelled",
              entityType: "Organization",
              entityId: organization.id,
            });
          }
        }
        break;
      }

      // A renewal charge failed. Mirrors how the old Stripe integration
      // treated past_due: still let the school in while Paystack's own
      // retry schedule runs, rather than cutting access immediately on one
      // failed card.
      case "invoice.payment_failed": {
        const data = event.data as { subscription?: { subscription_code?: string } };
        const code = data.subscription?.subscription_code;
        if (code) {
          const organization = await db.organization.findUnique({
            where: { paystackSubscriptionCode: code },
          });
          if (organization) {
            await db.organization.update({
              where: { id: organization.id },
              data: { subscriptionStatus: "past_due" },
            });
          }
        }
        break;
      }

      default:
        // Other event types are intentionally ignored — Paystack sends
        // many more than this app currently acts on.
        break;
    }
  } catch (err) {
    // Log but still return a failure so Paystack retries — never silently
    // swallow a webhook processing error, since that's how an
    // organization's billing state quietly drifts from reality.
    console.error("Error processing Paystack webhook", event.event, err);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
