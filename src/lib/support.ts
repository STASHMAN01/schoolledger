// Real support mailbox, live on Zoho Mail as of the crechely.co.za domain
// migration. Every place that imports SUPPORT_EMAIL updates automatically.
export const SUPPORT_EMAIL = "support@crechely.co.za";

// [ADD REAL: WhatsApp number] — no real WhatsApp Business number has been
// supplied yet (audit item C3). Format when you have one: country code,
// no spaces/plus sign, e.g. "27821234567" for a South African number
// starting 082 123 4567. Logged in OPEN_QUESTIONS.md until this is filled
// in — the site currently shows a visibly-placeholder link rather than a
// fake or broken one.
export const WHATSAPP_NUMBER = "";

const WHATSAPP_PREFILL =
  "Hi Crechely, I have a question about the app for my preschool.";

export const WHATSAPP_LINK = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_PREFILL)}`
  : "#whatsapp-number-not-set";
