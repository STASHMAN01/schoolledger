"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOrg } from "../../OrgContext";
import { Button, Card, Disclosure, Input, Label } from "@/components/ui";

type Profile = {
  name: string;
  countryCode: string;
  currencyCode: string;
  addressLine1: string | null;
  addressLine2: string | null;
  province: string | null;
  logoImage: string | null;
  letterheadImage: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  hasBankAccountNumber: boolean;
  timezone: string;
};

const COMMON_TIMEZONES = [
  "Africa/Johannesburg",
  "Africa/Harare",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Cairo",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC",
];

// The stored/serialized cap — matches validation.ts's imageDataUrlSchema.
// Kept well under any serverless request-body ceiling even with both
// images attached at once, and the logo specifically is embedded straight
// into the page on every load (it's in the header), so a multi-megabyte
// file would slow the whole app down for everyone, not just whoever
// uploaded it. Rather than making people find/shrink a smaller file
// themselves, every upload is automatically resized and re-compressed
// client-side to comfortably fit — see compressImageToDataUrl below.
const MAX_DATA_URL_CHARS = 1_300_000;
// Soft target well under the hard cap, so there's room for the format/
// quality search below to land under MAX_DATA_URL_CHARS on the first
// candidate that fits, rather than needing to skim right against the edge.
const TARGET_DATA_URL_CHARS = 900_000;

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that file — it may not be a valid image."));
    };
    img.src = url;
  });
}

function drawToDataUrl(
  img: HTMLImageElement,
  maxDimension: number,
  mimeType: string,
  quality?: number
): string {
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image in this browser.");
  // JPEG has no alpha channel — flatten onto white first so a logo with a
  // transparent background doesn't end up with a black one instead.
  if (mimeType === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(mimeType, quality);
}

// Resizes/re-compresses an uploaded image down to something that comfortably
// fits as an inline data: URL, without the person needing to do anything
// themselves. Tries progressively smaller PNG renders first (preserving
// transparency, which matters for a logo) and only falls back to JPEG —
// which compresses far better but flattens transparency to white — if PNG
// genuinely can't get small enough. JPEG's quality/size tradeoff means this
// converges for essentially any real photo or logo file.
async function compressImageToDataUrl(file: File): Promise<string> {
  const img = await loadImageElement(file);
  const preferPng = file.type === "image/png" || file.type === "image/gif";

  if (preferPng) {
    for (const dim of [1400, 1000, 700, 500, 350]) {
      const dataUrl = drawToDataUrl(img, dim, "image/png");
      if (dataUrl.length <= TARGET_DATA_URL_CHARS) return dataUrl;
    }
  }

  for (const dim of [1600, 1300, 1000, 800, 600, 450]) {
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const dataUrl = drawToDataUrl(img, dim, "image/jpeg", quality);
      if (dataUrl.length <= TARGET_DATA_URL_CHARS) return dataUrl;
    }
  }

  // Last resort — small and low-quality, but should never actually be
  // reached for a normal logo/letterhead image.
  return drawToDataUrl(img, 300, "image/jpeg", 0.4);
}

function ImageUploadField({
  label,
  helpText,
  value,
  disabled,
  onChange,
}: {
  label: string;
  helpText: string;
  value: string | null;
  disabled: boolean;
  onChange: (dataUrl: string | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setCompressing(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      if (dataUrl.length > MAX_DATA_URL_CHARS) {
        // Practically unreachable — compressImageToDataUrl's last resort is
        // tiny — but never silently save something over the server's cap.
        setError("Could not shrink that image enough — please try a simpler/smaller file.");
        return;
      }
      onChange(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file — please try again.");
    } finally {
      setCompressing(false);
    }
  }

  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2 flex items-center gap-4">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URL, not a Next-optimizable remote image
          <img
            src={value}
            alt={label}
            className="h-16 max-w-[160px] rounded-lg border border-border object-contain"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border-strong text-xs text-muted">
            None
          </div>
        )}
        {!disabled && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={compressing}
                onClick={() => inputRef.current?.click()}
              >
                {compressing ? "Processing…" : value ? "Replace" : "Upload"}
              </Button>
              {value && !compressing && (
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
                  Remove
                </Button>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{helpText}</p>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export default function GeneralSettingsPage() {
  const { organizationId, role } = useOrg();
  const isAdmin = role === "ADMIN";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [province, setProvince] = useState("");
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [logoTouched, setLogoTouched] = useState(false);
  const [letterheadImage, setLetterheadImage] = useState<string | null>(null);
  const [letterheadTouched, setLetterheadTouched] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountTouched, setBankAccountTouched] = useState(false);
  const [timezone, setTimezone] = useState("Africa/Johannesburg");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/organizations/${organizationId}/profile`);
    const data = await res.json();
    if (res.ok) {
      const org: Profile = data.organization;
      setProfile(org);
      setName(org.name);
      setAddressLine1(org.addressLine1 ?? "");
      setAddressLine2(org.addressLine2 ?? "");
      setProvince(org.province ?? "");
      setLogoImage(org.logoImage ?? null);
      setLogoTouched(false);
      setLetterheadImage(org.letterheadImage ?? null);
      setLetterheadTouched(false);
      setContactName(org.contactName ?? "");
      setContactEmail(org.contactEmail ?? "");
      setContactPhone(org.contactPhone ?? "");
      setBankName(org.bankName ?? "");
      setBankAccountNumber(isAdmin ? org.bankAccountNumber ?? "" : "");
      setTimezone(org.timezone);
    }
    setLoading(false);
  }, [organizationId, isAdmin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          addressLine1,
          addressLine2,
          province,
          ...(logoTouched ? { logoImage } : {}),
          ...(letterheadTouched ? { letterheadImage } : {}),
          contactName,
          contactEmail,
          contactPhone,
          bankName,
          // Only send the account number if the admin actually typed
          // something new — see the route's comment on why "omitted" and
          // "cleared" are treated differently.
          ...(bankAccountTouched ? { bankAccountNumber } : {}),
          timezone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save changes.");
        return;
      }
      setSaved(true);
      setBankAccountTouched(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!profile) {
    return <p className="text-sm text-danger">Could not load school profile.</p>;
  }

  return (
    <div className="animate-in max-w-2xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            School profile
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This information appears on statements and receipts sent to parents.
            Click a section below to open it.
          </p>
        </div>
      </div>

      {!isAdmin && (
        <Card className="mb-6 p-4 text-sm text-muted-foreground">
          Only an admin can change these settings. You can view them here.
        </Card>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Disclosure title="Basics" defaultOpen>
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="name">School name</Label>
              <Input
                id="name"
                required
                disabled={!isAdmin}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Country</Label>
                <Input value={profile.countryCode} disabled className="mt-1" />
              </div>
              <div>
                <Label>Currency</Label>
                <Input value={profile.currencyCode} disabled className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                list="timezone-options"
                disabled={!isAdmin}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1"
              />
              <datalist id="timezone-options">
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz} />
                ))}
              </datalist>
              <p className="mt-1 text-xs text-muted-foreground">
                Used for reminder scheduling and statement dates. Country/currency
                are set once at signup and can&apos;t be changed here.
              </p>
            </div>
          </div>
        </Disclosure>

        <Disclosure
          title="Contact details"
          description="Who to reach about this account — doesn't need to be a person with a login."
        >
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="contactName">Contact name</Label>
              <Input
                id="contactName"
                disabled={!isAdmin}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="contactEmail">Contact email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  disabled={!isAdmin}
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="contactPhone">Contact phone</Label>
                <Input
                  id="contactPhone"
                  disabled={!isAdmin}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </Disclosure>

        <Disclosure title="Address">
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="addressLine1">Address line 1</Label>
              <Input
                id="addressLine1"
                disabled={!isAdmin}
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="addressLine2">Address line 2</Label>
              <Input
                id="addressLine2"
                disabled={!isAdmin}
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="province">Province / state</Label>
              <Input
                id="province"
                disabled={!isAdmin}
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </Disclosure>

        <Disclosure title="Branding" description="Your logo and letterhead, printed on statements.">
          <div className="flex flex-col gap-6">
            <ImageUploadField
              label="Logo"
              helpText="Shown in the app and on statements. Any PNG, JPG, WebP or GIF — it's automatically resized to keep pages fast."
              value={logoImage}
              disabled={!isAdmin}
              onChange={(dataUrl) => {
                setLogoImage(dataUrl);
                setLogoTouched(true);
              }}
            />
            <ImageUploadField
              label="Letterhead"
              helpText="Printed at the top of PDF statements. Same file types — also resized automatically."
              value={letterheadImage}
              disabled={!isAdmin}
              onChange={(dataUrl) => {
                setLetterheadImage(dataUrl);
                setLetterheadTouched(true);
              }}
            />
          </div>
        </Disclosure>

        <Disclosure
          title="Bank details"
          description={
            isAdmin ? "Printed on statements. Only admins can view or change it." : "Only visible to admins."
          }
        >
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="bankName">Bank name</Label>
              <Input
                id="bankName"
                disabled={!isAdmin}
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="bankAccountNumber">Account number</Label>
              <Input
                id="bankAccountNumber"
                disabled={!isAdmin}
                value={bankAccountNumber}
                onChange={(e) => {
                  setBankAccountNumber(e.target.value);
                  setBankAccountTouched(true);
                }}
                placeholder={
                  !isAdmin && profile.hasBankAccountNumber
                    ? "•••• set"
                    : "Account number"
                }
                className="mt-1"
              />
            </div>
          </div>
        </Disclosure>

        {error && <p className="text-sm text-danger">{error}</p>}
        {saved && <p className="text-sm text-success">Saved.</p>}

        {isAdmin && (
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
