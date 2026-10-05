"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

// A finger / stylus signature box (Dylan, 5 Oct 2026: parents sign the
// medicine form on the tablet). Strokes are stored as 0..1 fractions of the
// box, so the drawing survives a resize (rotating the tablet). onChange gets
// a small transparent PNG data URL once there is a real signature, or null.

type Point = { x: number; y: number };
const INK = "#0b2a5b";
const MIN_POINTS = 14;
const EXPORT_WIDTH = 480;

export function SignaturePad({
  onChange,
  height = 176,
  label = "Parent signs here",
}: {
  onChange: (dataUrl: string | null) => void;
  height?: number;
  label?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height: h } = canvas;
    ctx.clearRect(0, 0, width, h);
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = Math.max(2, width / 260);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokes.current) {
      if (stroke.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke[0].x * width, stroke[0].y * h, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      stroke.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * width, p.y * h) : ctx.lineTo(p.x * width, p.y * h)));
      ctx.stroke();
    }
  }, []);

  // Size the bitmap to the box (and to the screen's pixel density) and redraw.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(200, Math.round(wrap.clientWidth));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(height * dpr);
      paint();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [height, paint]);

  function emit() {
    const canvas = canvasRef.current;
    const total = strokes.current.reduce((n, s) => n + s.length, 0);
    if (!canvas || total < MIN_POINTS) {
      setHasInk(false);
      onChange(null);
      return;
    }
    // Export small: a clean 480px-wide PNG keeps the form light.
    const out = document.createElement("canvas");
    const w = Math.min(EXPORT_WIDTH, canvas.width);
    out.width = w;
    out.height = Math.round((canvas.height / canvas.width) * w);
    out.getContext("2d")?.drawImage(canvas, 0, 0, out.width, out.height);
    setHasInk(true);
    onChange(out.toDataURL("image/png"));
  }

  function pointAt(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    strokes.current.push([pointAt(e)]);
    paint();
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    strokes.current[strokes.current.length - 1].push(pointAt(e));
    paint();
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    emit();
  }
  function clear() {
    strokes.current = [];
    paint();
    setHasInk(false);
    onChange(null);
  }

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-lg border-2 border-dashed border-border-strong bg-white"
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-crosshair"
          style={{ touchAction: "none" }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            {label}
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-4 bottom-8 border-b border-gray-300" />
      </div>
      <div className="mt-2 flex justify-end">
        <Button type="button" variant="secondary" size="sm" onClick={clear} disabled={!hasInk}>
          Clear and sign again
        </Button>
      </div>
    </div>
  );
}
