import nodemailer from "nodemailer";

// Deliberately the cheapest possible email setup rather than adding a paid
// transactional-email vendor: an app-password-authenticated Gmail SMTP
// account. Free, and enough volume for password resets on a product this
// size. If/when this needs to scale past what Gmail's sending limits
// allow, swap the transport in `getTransport()` for a real provider — the
// call site (`sendMail`) doesn't change.
//
// SMTP_HOST/PORT/USER/PASS are generic on purpose: Gmail works today
// (smtp.gmail.com:465, SMTP_USER = the Gmail address, SMTP_PASS = a
// 16-character Google "App Password", NOT the normal account password —
// generate one at myaccount.google.com/apppasswords with 2FA turned on),
// but this same code works unchanged against any other SMTP provider
// later just by changing the env vars.
let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (cachedTransport) return cachedTransport;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  cachedTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? Number(SMTP_PORT) : 465,
    secure: (SMTP_PORT ? Number(SMTP_PORT) : 465) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return cachedTransport;
}

export async function sendMail(opts: { to: string; subject: string; html: string; text: string }) {
  const transport = getTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  if (!transport || !from) {
    // Not configured yet (e.g. local dev, or before Dylan adds the SMTP_*
    // env vars in Vercel). Never throw — a missing mail setup shouldn't
    // break the request. The full body (which can contain reset/invite
    // links) is only logged outside production (final inspection R10).
    if (process.env.NODE_ENV === "production") {
      console.warn(`[mail] SMTP not configured — "${opts.subject}" was NOT sent.`);
    } else {
      console.warn(
        `[mail] SMTP not configured — would have sent "${opts.subject}" to ${opts.to}:\n${opts.text}`
      );
    }
    return { sent: false as const };
  }

  await transport.sendMail({
    from: `Crechely <${from}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  return { sent: true as const };
}
