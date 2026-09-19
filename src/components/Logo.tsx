import Image from "next/image";

// Single source of truth for the Crechely mark, wired to the real duck
// logo (added 2026-09-19, see CHANGELOG.md #C1). Before this, every
// instance below was a placeholder letter badge ("C" in most places, a
// leftover "T" from the TinyLedger name in the footer and on /login) —
// see CRECHELY_AUDIT.md C1 for the full list of where that stray "T" was
// found and fixed.
//
// `variant="icon"` renders just the round duck mark (header badges, small
// UI chrome). `variant="lockup"` renders the full icon+wordmark lockup —
// use on marketing pages where there's room. `tone="dark"` swaps in the
// white-wordmark asset for placement on a dark background (e.g. the
// homepage's closing panel, which uses bg-foreground).
export function Logo({
  variant = "icon",
  tone = "light",
  size = 32,
  className = "",
}: {
  variant?: "icon" | "lockup";
  tone?: "light" | "dark";
  size?: number;
  className?: string;
}) {
  if (variant === "icon") {
    return (
      <Image
        src="/brand/icon-transparent.png"
        alt="Crechely"
        width={size}
        height={size}
        className={className}
        priority
      />
    );
  }

  const src =
    tone === "dark"
      ? "/brand/lockup-horizontal-white-transparent.png"
      : "/brand/lockup-horizontal-navy.png";
  // Lockup source is 987x248 (icon+wordmark) — keep that aspect ratio.
  const width = Math.round(size * 3.98);

  return (
    <Image
      src={src}
      alt="Crechely"
      width={width}
      height={size}
      className={className}
      priority
    />
  );
}
