"use client";

// Up to two extra phone numbers for a parent/guardian, on top of their main
// one -- three in total (Dylan, 28 Sept 2026). The main number stays the one
// used for fees and reminders; these are just "also try" numbers.
import { Input } from "@/components/ui";

export const MAX_EXTRA_PHONES = 2;

export function ExtraPhonesField({
  idPrefix,
  values,
  onChange,
}: {
  idPrefix: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      {values.map((v, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor={`${idPrefix}-${i}`} className="mb-1 block text-sm font-medium text-foreground">
              Other phone {i + 1}
            </label>
            <Input
              id={`${idPrefix}-${i}`}
              type="tel"
              inputMode="tel"
              placeholder="082 123 4567"
              value={v}
              onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
            />
          </div>
          <button
            type="button"
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            className="min-h-11 px-2 text-sm text-muted-foreground underline hover:text-foreground"
          >
            Remove
          </button>
        </div>
      ))}
      {values.length < MAX_EXTRA_PHONES && (
        <div>
          <button
            type="button"
            onClick={() => onChange([...values, ""])}
            className="min-h-11 text-sm text-brand underline underline-offset-2"
          >
            + Add another phone number
          </button>
        </div>
      )}
    </div>
  );
}

/** Trimmed, non-empty extra numbers, ready to send. */
export function cleanExtraPhones(values: string[]): string[] {
  return values.map((v) => v.trim()).filter(Boolean).slice(0, MAX_EXTRA_PHONES);
}
