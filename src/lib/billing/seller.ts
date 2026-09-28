import { SUPPORT_EMAIL } from "@/lib/support";

// Who sold the subscription -- printed at the top of every Crechely
// subscription receipt (Settings -> Billing). This is the business
// registered on Paystack, which receives the money.
//
// vatNumber: leave null unless the business is VAT registered. When set,
// receipts print as a "Tax Invoice" showing the 15% VAT included in the
// price, as SARS expects; when null they're a plain "Receipt".
export const SELLER: {
  tradingName: string;
  legalName: string | null;
  addressLines: string[];
  registrationNumber: string | null;
  vatNumber: string | null;
  email: string;
  website: string;
} = {
  tradingName: "Crechely",
  // The business registered on Paystack (a Starter Business, not VAT
  // registered). Printed as "Crechely is a trading name of Straight Glow" so
  // a school can match the receipt to the name on its bank statement.
  legalName: "Straight Glow",
  addressLines: [], // [ADD REAL: business address, one line per entry]
  registrationNumber: null,
  vatNumber: null,
  email: SUPPORT_EMAIL,
  website: "www.crechely.co.za",
};

// South African standard VAT rate, used only when vatNumber is set.
export const VAT_RATE = 0.15;
