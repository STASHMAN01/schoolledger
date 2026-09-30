"use client";

// One "please upload X" line on a form (Add child, the parent online
// forms, the parent documents link): label, what it is, and an Upload
// button; once a file is picked it shows its name with Replace/Remove.
import { Badge, Button } from "@/components/ui";
import { DocumentUploadButton } from "@/components/DocumentUploadButton";

export function FormDocumentSlot({
  label,
  hint,
  required,
  fileName,
  onPick,
  onRemove,
}: {
  label: string;
  hint?: string;
  required: boolean;
  /** Name of the picked/uploaded file, or null when nothing yet. */
  fileName: string | null;
  onPick: (file: { dataUrl: string; fileName: string }) => Promise<string | null>;
  onRemove?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {label}{" "}
          {fileName ? (
            <Badge variant="success">Added</Badge>
          ) : required ? (
            <Badge variant="danger">Required</Badge>
          ) : (
            <Badge variant="neutral">Optional</Badge>
          )}
        </p>
        {fileName ? (
          <p className="truncate text-xs text-muted-foreground">{fileName}</p>
        ) : (
          hint && <p className="text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
      <div className="flex items-start gap-2">
        <DocumentUploadButton label={fileName ? "Replace" : "Upload"} onUpload={onPick} />
        {fileName && onRemove && (
          <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
