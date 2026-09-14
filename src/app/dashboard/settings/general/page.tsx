"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../OrgContext";
import { Button, Card, Input, Label, PageHeader } from "@/components/ui";

type Profile = {
  name: string;
  countryCode: string;
  currencyCode: string;
  addressLine1: string | null;
  addressLine2: string | null;
  province: string | null;
  logoUrl: string | null;
  letterheadUrl: string | null;
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
  const [logoUrl, setLogoUrl] = useState("");
  const [letterheadUrl, setLetterheadUrl] = useState("");
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
      setLogoUrl(org.logoUrl ?? "");
      setLetterheadUrl(org.letterheadUrl ?? "");
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
          logoUrl,
          letterheadUrl,
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
      <PageHeader
        title="School profile"
        description="This information appears on statements and receipts sent to parents."
      />

      {!isAdmin && (
        <Card className="mb-6 p-4 text-sm text-muted-foreground">
          Only an admin can change these settings. You can view them here.
        </Card>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <Card className="p-5">
          <h2 className="font-display mb-4 text-sm font-semibold text-foreground">
            Basics
          </h2>
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
                are set once at signup and can't be changed here.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display mb-4 text-sm font-semibold text-foreground">
            Address
          </h2>
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
        </Card>

        <Card className="p-5">
          <h2 className="font-display mb-4 text-sm font-semibold text-foreground">
            Branding
          </h2>
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                type="url"
                disabled={!isAdmin}
                placeholder="https://…"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="letterheadUrl">Letterhead image URL</Label>
              <Input
                id="letterheadUrl"
                type="url"
                disabled={!isAdmin}
                placeholder="https://…"
                value={letterheadUrl}
                onChange={(e) => setLetterheadUrl(e.target.value)}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Printed at the top of PDF statements. Host an image anywhere
                public (e.g. your website) and paste its URL — no file upload
                yet.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display mb-4 text-sm font-semibold text-foreground">
            Bank details
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Printed on statements so parents know where to pay. Stored encrypted —
            {isAdmin ? " only admins can view or change it." : " only visible to admins."}
          </p>
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
        </Card>

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
