import { FOUNDING_PRICE_CENTS } from "@/lib/billing/founding";

// The prices as they are written on the public pages.
//
// These used to be typed out separately on the homepage and on /pricing.
// That is exactly how the WhatsApp-reminder contradiction happened (the
// homepage, /pricing and its own FAQ each said something different), so
// the figures live in one place and both pages read them from here.
//
// Changing a price here does NOT change what Paystack charges — that
// comes from the plan codes in the environment. Update both together.

export const MONTHLY_PRICE_CENTS = 49_900;
export const YEARLY_PRICE_CENTS = 499_000;

// Comma-grouped on purpose. toLocaleString("en-ZA") groups with a space
// ("R4 990"), but every page, the page metadata and the outreach emails
// already write "R4,990", and the point of this module is that the site
// says one thing.
const rand = (cents: number) =>
  `R${String(Math.round(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

export const MONTHLY_PRICE = rand(MONTHLY_PRICE_CENTS);
export const YEARLY_PRICE = rand(YEARLY_PRICE_CENTS);
export const FOUNDING_PRICE = rand(FOUNDING_PRICE_CENTS);

/** Twelve months at the monthly price, for the yearly comparison. */
export const TWELVE_MONTHS_PRICE = rand(MONTHLY_PRICE_CENTS * 12);

/** What paying yearly saves against paying monthly for a year. */
export const YEARLY_VS_MONTHLY = rand(MONTHLY_PRICE_CENTS * 12 - YEARLY_PRICE_CENTS);

/**
 * That saving expressed in months, which is how the pricing page puts it
 * ("exactly 2 months free"). Computed rather than written down so it
 * can't quietly stop being true if a price changes.
 */
export const MONTHS_FREE_ON_YEARLY =
  (MONTHLY_PRICE_CENTS * 12 - YEARLY_PRICE_CENTS) / MONTHLY_PRICE_CENTS;
