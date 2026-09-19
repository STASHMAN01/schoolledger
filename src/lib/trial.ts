// Single source of truth for the free trial length. Previously 14 days,
// hardcoded independently in ~8 places (the register API route's actual
// trialEndsAt calculation, plus marketing copy on the homepage, /pricing,
// and /register) — easy to drift out of sync, and 14 days doesn't span one
// full monthly billing cycle, so nobody trialing the product ever
// experiences the automated month-end statement/reminder run that's the
// actual point of it. Changed to 30 so every trial covers at least one
// real cycle. Every place that mentioned the trial length imports this
// instead of repeating the number.
export const TRIAL_DAYS = 30;
