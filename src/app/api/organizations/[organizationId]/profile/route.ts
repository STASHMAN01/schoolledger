import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { organizationProfileSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { encryptField, decryptField } from "@/lib/fieldCrypto";

type Params = { params: Promise<{ organizationId: string }> };

// Bank account number is stored encrypted (see fieldCrypto.ts) — it's the
// one Organization field sensitive enough to warrant that, since it's
// printed on statements but otherwise never needs to be queried/searched.
// A masked version (last 4 digits only) is returned to every member; the
// full number is only decrypted for ADMINs, who are the only role allowed
// to change it anyway.
function maskAccountNumber(plain: string): string {
  const digitsOnly = plain.replace(/\s+/g, "");
  const last4 = digitsOnly.slice(-4);
  return `•••• ${last4}`;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { role } = await requireMembership(organizationId);

    const org = await db.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    let bankAccountNumberDisplay: string | null = null;
    if (org.bankAccountNumber) {
      try {
        const decrypted = decryptField(org.bankAccountNumber);
        bankAccountNumberDisplay =
          role === "ADMIN" ? decrypted : maskAccountNumber(decrypted);
      } catch {
        // A malformed/legacy value should never 500 the whole settings
        // page — surface it as unreadable so an admin knows to re-enter it.
        bankAccountNumberDisplay = "(unreadable — please re-enter)";
      }
    }

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        countryCode: org.countryCode,
        currencyCode: org.currencyCode,
        addressLine1: org.addressLine1,
        addressLine2: org.addressLine2,
        province: org.province,
        logoImage: org.logoImage,
        letterheadImage: org.letterheadImage,
        contactName: org.contactName,
        contactEmail: org.contactEmail,
        contactPhone: org.contactPhone,
        bankName: org.bankName,
        bankAccountNumber: bankAccountNumberDisplay,
        hasBankAccountNumber: Boolean(org.bankAccountNumber),
        timezone: org.timezone,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId } = await requireMembership(organizationId, ["ADMIN"]);

    const body = organizationProfileSchema.parse(await req.json());

    const org = await db.organization.update({
      where: { id: organizationId },
      data: {
        name: body.name,
        addressLine1: body.addressLine1 ?? null,
        addressLine2: body.addressLine2 ?? null,
        province: body.province ?? null,
        // Explicit null (from the "Remove" button) clears the image;
        // omitted (undefined, the field was never touched) leaves it as-is.
        ...(body.logoImage !== undefined ? { logoImage: body.logoImage } : {}),
        ...(body.letterheadImage !== undefined
          ? { letterheadImage: body.letterheadImage }
          : {}),
        contactName: body.contactName ?? null,
        contactEmail: body.contactEmail ?? null,
        contactPhone: body.contactPhone ?? null,
        bankName: body.bankName ?? null,
        // Only overwrite the stored (encrypted) account number when the
        // form actually sent a new value — the GET route only ever returns
        // a masked/decrypted display value, never something safe to write
        // straight back, so "unchanged" must mean "field omitted".
        ...(body.bankAccountNumber !== undefined
          ? { bankAccountNumber: encryptField(body.bankAccountNumber) }
          : {}),
        timezone: body.timezone,
      },
    });

    await logAudit({
      organizationId,
      userId,
      action: "organization.profileUpdated",
      entityType: "Organization",
      entityId: org.id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
