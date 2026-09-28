type SubscriptionFields = {
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  // End of the period the school has already paid for (Paystack's
  // next_payment_date, extended on every successful renewal charge -- see
  // the webhook handler). Optional so older call sites that only select
  // the two fields above keep compiling; without it a cancelled school is
  // treated as having no paid days left.
  currentPeriodEnd?: Date | null;
};

/**
 * Whether an organization currently has FULL access (can view and change
 * everything): an unexpired trial, a subscription in good standing, or a
 * cancelled subscription whose already-paid period hasn't run out yet.
 *
 * Without full access a school is READ-ONLY, not locked out (Dylan, 28
 * Sept 2026): every page and GET still works, but anything that changes
 * data is refused until an admin (re)subscribes -- enforced server-side in
 * requireMembership (src/lib/tenant.ts).
 *
 * "active" and "past_due" both keep full access -- Paystack handles
 * dunning/retries for past_due itself before the subscription is disabled;
 * cutting a school off the moment one card payment fails is worse than
 * letting Paystack's retry schedule run first.
 */
export function hasActiveAccess(org: SubscriptionFields): boolean {
  if (
    org.subscriptionStatus === "active" ||
    org.subscriptionStatus === "past_due" ||
    // Manually granted by a platform admin (see /platform/organizations) --
    // permanent access, entirely outside the Paystack lifecycle. Never set by
    // any webhook handler, so it only ever changes via that admin action.
    org.subscriptionStatus === "lifetime"
  ) {
    return true;
  }
  if (org.subscriptionStatus === "trialing") {
    return !org.trialEndsAt || org.trialEndsAt.getTime() > Date.now();
  }
  // Cancelled early: they already paid up to currentPeriodEnd, so they keep
  // every feature until then (Dylan, 28 Sept 2026).
  if (org.subscriptionStatus === "canceled") {
    return Boolean(org.currentPeriodEnd && org.currentPeriodEnd.getTime() > Date.now());
  }
  return false;
}
