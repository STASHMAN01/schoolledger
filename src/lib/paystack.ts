// Thin Paystack REST client, replacing the old Stripe SDK usage. Paystack
// has no official typed Node SDK worth depending on, so this is a small
// fetch wrapper — same "one client, lazily configured" shape as the old
// src/lib/stripe.ts had, just without a package to install.
//
// Docs: https://paystack.com/docs/api/
//
// Key differences from Stripe that shaped this file's shape:
// - Plans (monthly/yearly) are created once in the Paystack dashboard, not
//   via API here — same as Stripe Prices were. Their plan codes go in
//   PAYSTACK_PLAN_CODE_MONTHLY / PAYSTACK_PLAN_CODE_YEARLY.
// - There's no "create a Checkout Session, get a URL" call that also
//   creates the customer first — POST /transaction/initialize does both:
//   pass an email + plan code, get back an authorization_url to redirect to.
// - There's no hosted self-serve billing portal. Cancelling a subscription
//   is POST /subscription/disable, which needs the subscription's own
//   `code` AND `email_token` — both only ever arrive via the
//   subscription.create webhook event, never via a lookup call. That's why
//   the schema stores paystackEmailToken.

const PAYSTACK_BASE_URL = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not set. Add it to your environment before using billing features."
    );
  }
  return key;
}

async function paystackFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.status) {
    const message = body?.message ?? `Paystack request to ${path} failed (${res.status}).`;
    throw new Error(message);
  }
  return body.data as T;
}

export type PaystackInitializeResult = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

// Starts a subscription checkout: email + plan code in, a hosted
// authorization_url to redirect the browser to out. `metadata` is echoed
// back on the charge.success webhook event, which is how we correlate the
// very first payment with an organizationId (see the webhook route).
export async function initializeTransaction(params: {
  email: string;
  planCode: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<PaystackInitializeResult> {
  return paystackFetch<PaystackInitializeResult>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      plan: params.planCode,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });
}

export type PaystackPlan = {
  plan_code: string;
  amount: number; // smallest currency unit (cents for ZAR), same convention Stripe used
  interval: string;
  currency: string;
};

export async function getPlan(planCode: string): Promise<PaystackPlan> {
  return paystackFetch<PaystackPlan>(`/plan/${planCode}`, { method: "GET" });
}

// Cancels auto-renewal on a subscription. Needs the subscription's own
// `code` plus the `email_token` Paystack issued when the subscription was
// created (captured off the subscription.create webhook) — there is no way
// to fetch the token later, so if it's missing the caller must tell the
// admin to contact support rather than silently failing.
export async function disableSubscription(params: {
  code: string;
  token: string;
}): Promise<void> {
  await paystackFetch("/subscription/disable", {
    method: "POST",
    body: JSON.stringify({ code: params.code, token: params.token }),
  });
}
