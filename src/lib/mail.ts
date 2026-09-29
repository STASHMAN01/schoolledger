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

export type SendMailResult = { sent: true } | { sent: false; error?: string };

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Where replies go (e.g. a school's own address). */
  replyTo?: string;
  /** Display name shown instead of "Crechely". */
  fromName?: string;
  attachments?: { filename: string; content: Uint8Array }[];
}): Promise<SendMailResult> {
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
    return { sent: false, error: "SMTP not configured" };
  }

  // A real SMTP failure (bad/expired app password, Gmail blocking the
  // connection, a bounce, ...) used to throw straight out of here with
  // nowhere visible to see it -- every caller either doesn't await the
  // result (fire-and-forget) or, worse, has it silently swallowed by an
  // outer try/catch (e.g. registration, which must never fail just
  // because mail did). Catching it here and returning {sent:false,error}
  // instead means every caller CAN see and record why a send failed,
  // without this function ever needing to be the thing that breaks a
  // request. console.error still runs too, for whenever server logs are
  // reachable.
  try {
    await transport.sendMail({
      from: `${(opts.fromName ?? "Crechely").replace(/["<>\r\n]/g, "")} <${from}>`,
      to: opts.to,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      ...(opts.attachments?.length
        ? { attachments: opts.attachments.map((x) => ({ filename: x.filename, content: Buffer.from(x.content) })) }
        : {}),
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[mail] Failed to send "${opts.subject}" to ${opts.to}:`, err);
    return { sent: false, error: message };
  }
}
