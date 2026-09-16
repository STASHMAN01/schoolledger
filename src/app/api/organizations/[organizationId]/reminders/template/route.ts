import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { reminderTemplateSchema } from "@/lib/validation";
import { DEFAULT_REMINDER_TEMPLATE } from "@/lib/billing/reminderTemplates";
import { canHandleReminderSend } from "@/lib/reminderSend";

type Params = { params: Promise<{ organizationId: string }> };

// The org's saved reminder message wording (see reminderTemplates.ts for
// the placeholder tokens and the 5 built-in options this can be reset to).
// Deliberately a small, dedicated endpoint rather than folded into the
// full organizationProfileSchema PATCH (which requires every profile
// field and is ADMIN-only) — anyone who can request/approve a "send all"
// (ADMIN or ACCOUNTANT) should be able to tune the wording too, without
// needing to touch the rest of the school's profile.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId); // any role may view

    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: { reminderMessageTemplate: true },
    });
    if (!organization) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json({
      template: organization.reminderMessageTemplate ?? DEFAULT_REMINDER_TEMPLATE,
      isDefault: !organization.reminderMessageTemplate,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role } = await requireMembership(organizationId);
    if (!canHandleReminderSend(role)) {
      return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });
    }

    const body = reminderTemplateSchema.parse(await req.json());

    // Saving exactly the default text back is treated the same as "reset
    // to default" (store null) rather than persisting a redundant copy —
    // keeps DEFAULT_REMINDER_TEMPLATE as the single source of truth for
    // what "default" actually reads, so it can still be improved later
    // without a migration touching every org that never customized it.
    const toStore = body.template === DEFAULT_REMINDER_TEMPLATE ? null : body.template;

    await db.organization.update({
      where: { id: organizationId },
      data: { reminderMessageTemplate: toStore },
    });

    await logAudit({
      organizationId,
      userId,
      action: "reminders.templateUpdated",
      entityType: "Organization",
    });

    return NextResponse.json({ template: toStore ?? DEFAULT_REMINDER_TEMPLATE });
  } catch (err) {
    return handleApiError(err);
  }
}
