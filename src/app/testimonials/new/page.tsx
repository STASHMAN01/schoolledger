"use client";

import { useState } from "react";
import Link from "next/link";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";

// Public submission form for the homepage's "Give a testimonial" flow —
// see prisma/schema.prisma's Testimonial model and
// /platform/testimonials for the moderation side. Nothing submitted here
// shows on the site until Dylan approves it.
export default function NewTestimonialPage() {
  const [authorName, setAuthorName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [quote, setQuote] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — real users never see this field
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName, schoolName, quote, website }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not submit this. Try again in a moment.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Try again in a moment.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
          <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
            Give a testimonial
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Used Crechely and have a minute? A few honest sentences about what changed for you
            helps other schools trust this more than anything I could write myself. It&rsquo;s
            reviewed before it goes anywhere on the site — nothing appears automatically.
          </p>

          <Card className="mt-6 p-6">
            {done ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-foreground">
                  Thank you — this has been sent for review. If it&rsquo;s approved,
                  it&rsquo;ll appear on the homepage.
                </p>
                <Link href="/" className="text-sm font-medium text-brand hover:underline">
                  ← Back to Crechely
                </Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="authorName">Your name</Label>
                  <Input
                    id="authorName"
                    required
                    maxLength={120}
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="schoolName">School / crèche name (optional)</Label>
                  <Input
                    id="schoolName"
                    maxLength={200}
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="quote">Your testimonial</Label>
                  <Textarea
                    id="quote"
                    required
                    rows={5}
                    minLength={20}
                    maxLength={1000}
                    value={quote}
                    onChange={(e) => setQuote(e.target.value)}
                    placeholder="What was it like before Crechely, and what changed?"
                    className="mt-1"
                  />
                </div>
                {/* Honeypot — hidden from real visitors with CSS, not display:none
                    (some bots skip those), and never tab-reachable. */}
                <div className="absolute -left-[9999px]" aria-hidden="true">
                  <label htmlFor="website">Leave this field blank</label>
                  <input
                    id="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-danger">{error}</p>}
                <Button type="submit" disabled={submitting} className="mt-2">
                  {submitting ? "Sending…" : "Submit testimonial"}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
