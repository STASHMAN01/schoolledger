import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, isPasswordStrongEnough } from "@/lib/password";
import { registerSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";
import { TRIAL_DAYS } from "@/lib/trial";

// Creates a brand new Organization (school) plus its first user as ADMIN.
// This is the ONLY place a User + Membership + Organization get created
// together in one transaction — everywhere else, users join an existing
// organization only via a valid, unexpired Invite (see invites route,
// not yet built) so no one can silently attach themselves to someone
// else's school.
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const { allowed } = rateLimit(`register:${ip}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { organizationName, countryCode, currencyCode, adminName, email, password } =
    parsed.data;

  if (!isPasswordStrongEnough(password)) {
    return NextResponse.json(
      { error: "Password must be at least 10 characters." },
      { status: 400 }
    );
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Generic message: never confirm/deny an email already has an account
    // via a distinct error, which would let an attacker enumerate users.
    return NextResponse.json(
      { error: "Could not create account with those details." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);

  const result = await db.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: organizationName,
        countryCode,
        currencyCode,
        trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name: adminName,
      },
    });

    await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: "ADMIN",
      },
    });

    // Seed the starter payment types every school needs from day one, per
    // the original product spec — editable/deletable afterwards except
    // that at least one recurring type must always remain.
    await tx.paymentType.createMany({
      data: [
        { organizationId: organization.id, name: "School Fees", isRecurring: true },
        { organizationId: organization.id, name: "Registration", isRecurring: false },
        { organizationId: organization.id, name: "Uniform", isRecurring: false },
        { organizationId: organization.id, name: "Trip", isRecurring: false },
        { organizationId: organization.id, name: "Aftercare", isRecurring: true },
        { organizationId: organization.id, name: "Other", isRecurring: false },
      ],
    });

    return { organization, user };
  });

  await logAudit({
    organizationId: result.organization.id,
    userId: result.user.id,
    action: "organization.created",
    entityType: "Organization",
    entityId: result.organization.id,
  });

  return NextResponse.json({
    organizationId: result.organization.id,
  });
}
