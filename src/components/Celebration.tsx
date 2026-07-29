"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import type { CelebrationEffect } from "@/lib/metrics/celebration";

const SCRUMI_COLORS = ["#A5BAFF", "#5E80EE", "#3EDBB6", "#F59E4A", "#FFFFFF"];

/** Feenstaub: feiner Glitzer-Regen von oben über die ganze Breite. */
function playConfetti() {
  for (const x of [0.2, 0.5, 0.8]) {
    confetti({
      particleCount: 60,
      angle: 90,
      spread: 110,
      origin: { x, y: -0.05 },
      startVelocity: 16,
      gravity: 0.5,
      scalar: 0.75,
      ticks: 280,
      colors: SCRUMI_COLORS,
    });
  }
}

/** Feuerwerk: zufällige Salven über ~3 Sekunden. */
function playFireworks(): () => void {
  const end = Date.now() + 3000;
  const timer = setInterval(() => {
    if (Date.now() > end) {
      clearInterval(timer);
      return;
    }
    confetti({
      particleCount: 80,
      startVelocity: 34,
      spread: 360,
      ticks: 90,
      origin: { x: 0.15 + Math.random() * 0.7, y: 0.15 + Math.random() * 0.4 },
      colors: SCRUMI_COLORS,
    });
  }, 280);
  return () => clearInterval(timer);
}

/**
 * Spielt beim Einbinden den übergebenen Feier-Effekt ab. Rendert kein DOM und
 * blockiert keine Interaktion (canvas-confetti nutzt ein pointer-events:none-Canvas).
 */
export function Celebration({ effect }: { effect: CelebrationEffect | null }) {
  useEffect(() => {
    if (effect === "confetti") playConfetti();
    if (effect === "fireworks") return playFireworks();
  }, [effect]);

  return null;
}
