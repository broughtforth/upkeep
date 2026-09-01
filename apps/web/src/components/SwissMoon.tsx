"use client";

import { useEffect, useState } from "react";

/**
 * A whimsical crescent moon — made of swiss cheese — that drifts into the
 * top-LEFT area of the dashboard ONLY when night mode is active.
 *
 * Built as inline SVG so it lives independently of the 3D canvas.
 * The "swiss cheese" look is achieved by punching circular holes in the
 * crescent shape using SVG <mask>. The crescent itself is the intersection
 * of two offset circles.
 *
 * Render conditions: hidden unless <html data-mode="evening">. We watch
 * the attribute via MutationObserver — same trick the canvas lighting uses.
 */
export function SwissMoon() {
  const [night, setNight] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    const sync = () => setNight(html.getAttribute("data-mode") === "evening");
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(html, { attributes: true, attributeFilter: ["data-mode"] });
    return () => obs.disconnect();
  }, []);

  if (!night) return null;

  return (
    <div
      className="pointer-events-none absolute left-6 top-24 z-10 transition-opacity duration-700"
      aria-hidden
      style={{
        // gentle float so it doesn't feel like a static sticker.
        animation: "swiss-moon-float 8s ease-in-out infinite",
      }}
    >
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Mask that builds the crescent: big yellow circle minus an
              offset circle on the right. */}
          <mask id="crescent-mask">
            <rect width="120" height="120" fill="black" />
            {/* The full moon disc */}
            <circle cx="56" cy="60" r="42" fill="white" />
            {/* The bite taken out of the right side */}
            <circle cx="78" cy="54" r="40" fill="black" />
            {/* Cheese holes — black on the mask = cut out of the crescent. */}
            <circle cx="36" cy="46" r="5" fill="black" />
            <circle cx="48" cy="70" r="7" fill="black" />
            <circle cx="32" cy="78" r="4" fill="black" />
            <circle cx="58" cy="86" r="5" fill="black" />
            <circle cx="42" cy="58" r="3" fill="black" />
            <circle cx="26" cy="62" r="3.5" fill="black" />
            <circle cx="60" cy="44" r="4" fill="black" />
          </mask>

          {/* A faint warm gradient so the cheese reads as 3D, not flat. */}
          <radialGradient id="cheese-fill" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFE89A" />
            <stop offset="55%" stopColor="#F4C758" />
            <stop offset="100%" stopColor="#C99232" />
          </radialGradient>
        </defs>

        {/* the crescent, holes punched out */}
        <rect
          width="120"
          height="120"
          fill="url(#cheese-fill)"
          mask="url(#crescent-mask)"
        />

        {/* A couple of subtle highlights inside the holes so they read as
            recessed pits rather than transparent. Tucked just inside each
            hole's rim. */}
        <circle cx="36" cy="46" r="2" fill="#A87922" opacity="0.55" />
        <circle cx="48" cy="70" r="2.5" fill="#A87922" opacity="0.55" />
        <circle cx="58" cy="86" r="1.8" fill="#A87922" opacity="0.55" />
      </svg>

      <style jsx>{`
        @keyframes swiss-moon-float {
          0%,
          100% {
            transform: translateY(0) rotate(-3deg);
          }
          50% {
            transform: translateY(-6px) rotate(2deg);
          }
        }
      `}</style>
    </div>
  );
}
