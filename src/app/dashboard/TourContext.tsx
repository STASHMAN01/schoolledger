"use client";

// Shared open/close state for the first-time guided walkthrough (one per
// mode). A context rather than local page state because the trigger (auto
// on a home page, or the header's "Take a tour" link) and the display
// (TourOverlay, mounted once in the dashboard layout so it can spotlight
// header elements too) live in different components.
import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type TourMode = "centre" | "accounting";

type TourContextValue = {
  activeTour: TourMode | null;
  start: (mode: TourMode) => void;
  stop: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [activeTour, setActiveTour] = useState<TourMode | null>(null);
  const start = useCallback((mode: TourMode) => setActiveTour(mode), []);
  const stop = useCallback(() => setActiveTour(null), []);
  const value = useMemo(() => ({ activeTour, start, stop }), [activeTour, start, stop]);
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
}
