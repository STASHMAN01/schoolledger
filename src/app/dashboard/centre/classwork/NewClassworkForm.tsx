"use client";

// Recording classwork, photos first (Dylan, 15 Oct 2026). Three steps:
//   1. Group or individual activity
//   2. The photos (staged -- not on any entry yet)
//   3. The description, which stays locked until the photos are complete
// Teachers kept skipping the photos when the description could be saved
// first. The server enforces the same rule (POST /classwork refuses an entry
// without its photos), so this form is only the friendly way in.
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button, Card, Textarea } from "@/components/ui";
import { useConfirmDialog } from "@/components/useConfirmDialog";
import { checkClassworkPhotos } from "@/lib/classwork";
import { MAX_GROUP_PHOTOS } from "@/lib/lessonPlan";
import { Thumb, uploadClassworkPhoto, type ClassworkPhoto } from "./ClassworkPhotos";

type ActivityType = "GROUP" | "INDIVIDUAL";
export type PresentChild = { id: string; firstName: string; lastName: string };

const buttonClass =
  "transition-standard inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-background disabled:opacity-60";

export function NewClassworkForm({
  organizationId,
  staged,
  presentChildren,
  registerTaken,
  onChanged,
}: {
  organizationId: string;
  /** This teacher's photos taken but not yet submitted. */
  staged: ClassworkPhoto[];
  /** Children marked present in today's register. */
  presentChildren: PresentChild[];
  registerTaken: boolean;
  /** Reload the page's data (after a photo is added/removed or the entry saved). */
  onChanged: () => void;
}) {
  const { confirm, dialog } = useConfirmDialog();
  const [chosenType, setChosenType] = useState<ActivityType>("GROUP");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const childRef = useRef<HTMLInputElement>(null);
  const childGalleryRef = useRef<HTMLInputElement>(null);
  // Which child the next file picked is for (individual activity only).
  const pendingChildId = useRef<string | null>(null);

  // Once any photo is staged the type is locked to what those photos are.
  const locked = staged.length > 0;
  const activityType: ActivityType = locked ? (staged.some((p) => p.childId) ? "INDIVIDUAL" : "GROUP") : chosenType;

  const check = useMemo(
    () => checkClassworkPhotos({ activityType, photos: staged, presentChildren, registerTaken }),
    [activityType, staged, presentChildren, registerTaken]
  );
  const photosDone = check.ok;
  const canSave = photosDone && !!text.trim() && !saving && !busy;

  // Normally one photo per child. If a double tap ever left two, both show
  // (each with a remove button) rather than one being hidden.
  const byChild = new Map<string, ClassworkPhoto[]>();
  for (const p of staged) if (p.childId) byChild.set(p.childId, [...(byChild.get(p.childId) ?? []), p]);
  const presentIds = new Set(presentChildren.map((c) => c.id));
  const strangers = staged.filter((p) => p.childId && !presentIds.has(p.childId)).length;
  const doneCount = presentChildren.filter((c) => byChild.has(c.id)).length;
  const doubled = [...byChild.values()].some((list) => list.length > 1);

  async function addFiles(files: FileList | null, childId: string | null, inputs: (HTMLInputElement | null)[]) {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    setError("");
    setBusy(true);
    try {
      const room = childId ? 1 : MAX_GROUP_PHOTOS - staged.length;
      for (const file of list.slice(0, Math.max(room, 0))) {
        await uploadClassworkPhoto(organizationId, file, { childId });
      }
      if (!childId && list.length > room) setError(`Only ${MAX_GROUP_PHOTOS} photos fit. The rest weren't added.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that photo.");
    } finally {
      setBusy(false);
      for (const input of inputs) if (input) input.value = "";
      onChanged();
    }
  }

  async function removePhoto(id: string) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/organizations/${organizationId}/uploads/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) setError("Could not remove that photo.");
    onChanged();
  }

  async function startOver() {
    const ok = await confirm({
      title: "Start over?",
      description: "The photos you've added so far are deleted, and you can pick the activity type again.",
      confirmLabel: "Start over",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    setError("");
    const results = await Promise.all(
      staged.map((p) => fetch(`/api/organizations/${organizationId}/uploads/${p.id}`, { method: "DELETE" }))
    );
    setBusy(false);
    if (results.some((r) => !r.ok)) setError("Some photos could not be removed. Please try again.");
    onChanged();
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/organizations/${organizationId}/classwork`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityType, description: text, photoIds: staged.map((p) => p.id) }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save. Please try again.");
      onChanged();
      return;
    }
    setText("");
    setChosenType("GROUP");
    onChanged();
  }

  return (
    <Card as="div" className="mb-5 space-y-5 p-4">
      {dialog}

      {/* Step 1 */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold text-foreground">1. What kind of activity?</h2>
          {locked && (
            <button
              type="button"
              onClick={startOver}
              disabled={busy || saving}
              className="text-sm text-danger underline underline-offset-2 disabled:opacity-60"
            >
              Start over
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {(["GROUP", "INDIVIDUAL"] as const).map((t) => (
            <button
              key={t}
              type="button"
              disabled={locked}
              onClick={() => setChosenType(t)}
              className={`transition-standard min-h-11 rounded-lg border px-3 text-sm font-medium disabled:cursor-not-allowed ${
                activityType === t
                  ? "border-brand bg-brand-soft text-brand-soft-foreground"
                  : "border-border text-muted-foreground hover:bg-background disabled:opacity-50 disabled:hover:bg-transparent"
              }`}
            >
              {t === "GROUP" ? "Group activity" : "Individual activity"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {activityType === "GROUP"
            ? `Photos of the class doing it together (up to ${MAX_GROUP_PHOTOS}).`
            : "A photo of each child who is here today doing it on their own."}
          {locked && " Tap Start over to change the type."}
        </p>
      </section>

      {/* Step 2 */}
      <section>
        <h2 className="font-display mb-2 text-sm font-semibold text-foreground">2. Add the photos</h2>

        {activityType === "GROUP" ? (
          <>
            {staged.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {staged.map((p) => (
                  <Thumb key={p.id} organizationId={organizationId} photo={p} canRemove busy={busy} onRemove={removePhoto} />
                ))}
              </div>
            )}
            {staged.length < MAX_GROUP_PHOTOS && (
              <div className="flex flex-wrap gap-2">
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files, null, [cameraRef.current, galleryRef.current])}
                />
                <input
                  ref={galleryRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files, null, [cameraRef.current, galleryRef.current])}
                />
                <button type="button" onClick={() => cameraRef.current?.click()} disabled={busy || saving} className={buttonClass}>
                  {busy ? "Adding photo…" : "Take a photo"}
                </button>
                <button type="button" onClick={() => galleryRef.current?.click()} disabled={busy || saving} className={buttonClass}>
                  Choose from gallery
                </button>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {staged.length} of {MAX_GROUP_PHOTOS} photos added. At least one is needed.
            </p>
          </>
        ) : !registerTaken ? (
          <p className="rounded-lg border border-border bg-background p-3 text-sm text-foreground">
            Take today&apos;s register first, so we know which children need a photo.{" "}
            <Link href="/dashboard/centre/attendance" className="font-medium text-brand underline underline-offset-2">
              Go to the register
            </Link>
          </p>
        ) : presentChildren.length === 0 ? (
          <p className="rounded-lg border border-border bg-background p-3 text-sm text-foreground">
            Nobody is marked present today, so there is nobody to take a photo of.{" "}
            <Link href="/dashboard/centre/attendance" className="font-medium text-brand underline underline-offset-2">
              Check the register
            </Link>
          </p>
        ) : (
          <>
            <input
              ref={childRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => addFiles(e.target.files, pendingChildId.current, [childRef.current, childGalleryRef.current])}
            />
            <input
              ref={childGalleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => addFiles(e.target.files, pendingChildId.current, [childRef.current, childGalleryRef.current])}
            />
            <p className="mb-2 text-sm font-medium text-foreground">
              {doneCount} of {presentChildren.length} children
            </p>
            <div className="divide-y divide-border rounded-lg border border-border">
              {presentChildren.map((child) => {
                const photos = byChild.get(child.id) ?? [];
                const pick = (input: HTMLInputElement | null) => {
                  pendingChildId.current = child.id;
                  input?.click();
                };
                return (
                  <div key={child.id} className="flex items-center gap-3 p-2">
                    {photos.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {photos.map((photo) => (
                          <Thumb
                            key={photo.id}
                            organizationId={organizationId}
                            photo={photo}
                            canRemove
                            busy={busy}
                            onRemove={removePhoto}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                        No photo
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">
                        {child.firstName} {child.lastName}
                      </p>
                      {photos.length > 0 ? (
                        <p className="mt-1 text-sm font-medium text-brand">
                          <span aria-hidden="true">&#10003;</span> Photo added
                        </p>
                      ) : (
                        <div className="mt-1 flex flex-wrap gap-2">
                          <button type="button" onClick={() => pick(childRef.current)} disabled={busy || saving} className={buttonClass}>
                            {busy ? "Adding…" : "Add photo"}
                          </button>
                          <button
                            type="button"
                            onClick={() => pick(childGalleryRef.current)}
                            disabled={busy || saving}
                            className={buttonClass}
                          >
                            From gallery
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {doubled && (
              <p className="mt-2 text-xs text-danger">
                A child has two photos. Remove one of them with the &times; button.
              </p>
            )}
            {strangers > 0 && (
              <p className="mt-2 text-xs text-danger">
                Some photos are of children who aren&apos;t marked present today. Tap Start over and redo them.
              </p>
            )}
          </>
        )}
      </section>

      {/* Step 3 */}
      <section>
        <label htmlFor="classwork-text" className="font-display mb-2 block text-sm font-semibold text-foreground">
          3. What did you do with the children today?
        </label>
        <Textarea
          id="classwork-text"
          rows={4}
          maxLength={5000}
          value={text}
          disabled={!photosDone}
          placeholder="e.g. Painted leaves and counted to 10 in groups"
          onChange={(e) => setText(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {photosDone
            ? "Please don't put medical or private details here. Entries can't be changed once added."
            : "Add the photos first"}
        </p>
        <div className="mt-3">
          <Button onClick={save} disabled={!canSave}>
            {saving ? "Saving…" : "Add to today"}
          </Button>
        </div>
      </section>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>
      )}
    </Card>
  );
}
