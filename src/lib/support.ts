// Real support mailbox, live on Zoho Mail as of the crechely.co.za domain
// migration. Every place that imports SUPPORT_EMAIL updates automatically.
export const SUPPORT_EMAIL = "support@crechely.co.za";

// Real WhatsApp number (Dylan, 1 Oct 2026), supplied as +27 61 649 7100.
export const WHATSAPP_NUMBER = "27616497100";

const WHATSAPP_PREFILL =
  "Hi Crechely, I have a question about the app for my preschool.";

export const WHATSAPP_LINK = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_PREFILL)}`
  : "#whatsapp-number-not-set";
