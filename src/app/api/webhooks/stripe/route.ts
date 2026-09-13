import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { logAudit } from "@/lib/audit";

// Stripe webhooks are the one endpoint in this app that's intentionally
// unauthenticated (no session, no membership check) — see PUBLIC_PATHS in
// src/middleware.ts. That's only safe because every request is verified
// against STRIPE_WEBHOOK_SECRET below: without a valid signature, nothing
// past that point ever runs. Never relax or remove the signature check to
// "make testing easier" — that would let anyone POST arbitrary subscription
// state for any organization.
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = session.client_reference_id;
        if (organizationId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id
          );
          await applySubscriptionToOrganization(organizationId, subscription);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata?.organizationId;
        if (organizationId) {
          await applySubscriptionToOrganization(organizationId, subscription);
        }
        break;
      }
      default:
        // Other event types are intentionally ignored — Stripe sends many
        // more than this app currently acts on.
        break;
    }
  } catch (err) {
    // Log but still return 200-ish failure as 500 so Stripe retries —
    // never silently swallow a webhook processing error, since that's how
    // an organization's billing state quietly drifts from reality.
    console.error("Error processing Stripe webhook", event.type, err);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function applySubscriptionToOrganization(
  organizationId: string,
  subscription: Stripe.Subscription
) {
  const item = subscription.items.data[0];
  await db.organization.update({
    where: { id: organizationId },
    data: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: item?.price.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: item?.current_period_end
        ? new Date(item.current_period_end * 1000)
        : null,
    },
  });

  await logAudit({
    organizationId,
    action: "billing.subscriptionUpdated",
    entityType: "Organization",
    entityId: organizationId,
    metadata: { status: subscription.status },
  });
}
