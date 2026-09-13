import Stripe from "stripe";

// One Stripe client for the whole app, same reasoning as the Prisma
// singleton in db.ts. Constructed lazily (not at module load) so importing
// this file doesn't crash local dev/build before STRIPE_SECRET_KEY is set —
// it only throws when a route actually tries to use it.
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set. Add it to your environment before using billing features."
      );
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}
