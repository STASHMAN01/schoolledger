type SubscriptionFields = {
  subscriptionStatus: string;
  trialEndsAt: Date | null;
};

/**
 * Whether an organization currently has access to the product: either an
 * unexpired trial, or a subscription in a status that should still
 * let them in ("active" and "past_due" both get access — Paystack itself
 * handles dunning/retries for past_due before it becomes "canceled"; kicking
 * a school out the moment one card payment fails is a worse experience
 * than letting Paystack's retry schedule run first).
 */
export function hasActiveAccess(org: SubscriptionFields): boolean {
  if (org.subscriptionStatus === "active" || org.subscriptionStatus === "past_due") {
    return true;
  }
  if (org.subscriptionStatus === "trialing") {
    return !org.trialEndsAt || org.trialEndsAt.getTime() > Date.now();
  }
  return false;
}
