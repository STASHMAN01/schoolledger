// Photos first, then the description (Dylan, 15 Oct 2026). Teachers kept
// skipping the photos when they could save the description first, so the
// photos are now uploaded "staged" (not yet on any entry) and the entry can
// only be created once they are all there. Pure helpers, no db: the route
// does the lookups and these decide.
import { MAX_GROUP_PHOTOS, type ActivityTypeValue } from "@/lib/lessonPlan";

/** Staged photos nobody submitted are deleted after this long. */
export const STAGED_PHOTO_HOURS = 24;

export type StagedPhotoInput = { childId: string | null };
export type PresentChild = { id: string; firstName: string };

export type PhotoCheck = { ok: true } | { ok: false; error: string; missingChildIds?: string[] };

/**
 * Whether the photos a teacher staged are enough to describe the activity.
 * The same rules drive the form (to enable the description box) and the
 * server (to refuse the save), so the two can't drift apart.
 */
export function checkClassworkPhotos(input: {
  activityType: ActivityTypeValue;
  photos: StagedPhotoInput[];
  presentChildren: PresentChild[];
  registerTaken: boolean;
}): PhotoCheck {
  const { activityType, photos, presentChildren, registerTaken } = input;

  if (activityType === "GROUP") {
    if (photos.length === 0) {
      return { ok: false, error: "Add at least one photo of the activity before describing it." };
    }
    if (photos.some((p) => p.childId)) {
      return { ok: false, error: "A group activity's photos aren't tagged to one child." };
    }
    if (photos.length > MAX_GROUP_PHOTOS) {
      return { ok: false, error: `A group activity can have up to ${MAX_GROUP_PHOTOS} photos.` };
    }
    return { ok: true };
  }

  if (!registerTaken) {
    return { ok: false, error: "Take today's register first, so we know which children need a photo." };
  }
  if (presentChildren.length === 0) {
    return {
      ok: false,
      error: "No children are marked present today, so there is nobody to take a photo of.",
    };
  }

  if (photos.some((p) => !p.childId)) {
    return { ok: false, error: "Each photo of an individual activity must be of one child." };
  }
  const presentIds = new Set(presentChildren.map((c) => c.id));
  if (photos.some((p) => !presentIds.has(p.childId as string))) {
    return { ok: false, error: "Some photos are of children who aren't marked present today. Start over to fix that." };
  }
  const seen = new Set<string>();
  for (const p of photos) {
    const id = p.childId as string;
    if (seen.has(id)) return { ok: false, error: "Each child can only have one photo." };
    seen.add(id);
  }

  const missing = presentChildren.filter((c) => !seen.has(c.id));
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Still need a photo of: ${missing.map((c) => c.firstName).join(", ")}.`,
      missingChildIds: missing.map((c) => c.id),
    };
  }
  return { ok: true };
}

// ---- Cleanup of staged photos that never became part of an entry --------

export type StagedCandidate = {
  kind: string;
  classworkEntryId: string | null;
  createdAt: Date;
};

/** Staged photos created before this moment are expired. */
export function stagedCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - STAGED_PHOTO_HOURS * 60 * 60 * 1000);
}

/** The photo is a staged classwork photo (not on an entry, not a report photo). */
export function isStaged(file: { kind: string; classworkEntryId: string | null }): boolean {
  return file.kind === "CLASSWORK" && file.classworkEntryId === null;
}

/** Staged and older than 24 hours, whether ACTIVE or still PENDING. */
export function isExpiredStaged(file: StagedCandidate, now: Date = new Date()): boolean {
  return isStaged(file) && file.createdAt.getTime() < stagedCutoff(now).getTime();
}

/** Prisma filter selecting exactly the files isExpiredStaged() accepts. */
export function expiredStagedWhere(now: Date = new Date()) {
  return {
    kind: "CLASSWORK",
    classworkEntryId: null,
    createdAt: { lt: stagedCutoff(now) },
  };
}
