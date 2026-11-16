"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export default function SplashScreen() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const dismissedRef = useRef(false);

  const dismiss = useCallback((immediate = false) => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;

    try {
      window.sessionStorage.setItem("chartglance_splash_played", "1");
    } catch {
      // Storage unavailable / restricted
    }

    if (immediate) {
      setVisible(false);
      return;
    }

    setIsFading(true);
    setTimeout(() => {
      setVisible(false);
    }, 250);
  }, []);

  useEffect(() => {
    setMounted(true);

    try {
      // 1. Skip if already played in this browser session
      if (window.sessionStorage.getItem("chartglance_splash_played") === "1") {
        return;
      }
      // 2. Skip if user prefers reduced motion
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        window.sessionStorage.setItem("chartglance_splash_played", "1");
        return;
      }
    } catch {
      // If access to sessionStorage or matchMedia fails, never block the app
      return;
    }

    // Mark as played so rapid tab refreshes do not re-trigger
    try {
      window.sessionStorage.setItem("chartglance_splash_played", "1");
    } catch {
      // Ignore
    }

    setVisible(true);

    // Sequence timing (total ~4.3s):
    // 0.0 - 0.8s: Navy sweep across the screen
    // 0.8 - 1.9s: White C draws anticlockwise
    // 1.9 - 2.9s: Blue heartbeat traces left-to-right
    // 2.9 - 3.4s: Red dot pops in with pulse ring
    // 3.4 - 3.8s: Hold complete logo still
    // 3.8 - 4.3s: Fade out to dashboard
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 3800);

    const completeTimer = setTimeout(() => {
      dismissedRef.current = true;
      setVisible(false);
    }, 4300);

    // Hard fail-safe timeout at 4.6s to ensure the app is never blocked
    const failSafeTimer = setTimeout(() => {
      dismissedRef.current = true;
      setVisible(false);
    }, 4600);

    // Skip on user interaction: click, tap, or key press
    const handleUserSkip = () => {
      dismiss(false);
    };

    window.addEventListener("pointerdown", handleUserSkip, { passive: true });
    window.addEventListener("keydown", handleUserSkip, { passive: true });

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
      clearTimeout(failSafeTimer);
      window.removeEventListener("pointerdown", handleUserSkip);
      window.removeEventListener("keydown", handleUserSkip);
    };
  }, [dismiss]);

  if (!mounted || !visible) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[9999] overflow-hidden flex items-center justify-center bg-[#12204A] transition-opacity duration-500 ease-out select-none cursor-pointer ${
        isFading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        animation: "splashSweepIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
    >
      <style>{`
        @keyframes splashSweepIn {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(0);
          }
        }
        @keyframes splashDrawC {
          0% {
            stroke-dashoffset: 1300;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        @keyframes splashDrawBeat {
          0% {
            stroke-dashoffset: 700;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        @keyframes splashPopDot {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          65% {
            transform: scale(1.22);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes splashPulseRing {
          0% {
            transform: scale(1);
            opacity: 0.8;
            stroke-width: 12;
          }
          100% {
            transform: scale(2.3);
            opacity: 0;
            stroke-width: 2;
          }
        }
        .splash-c-stroke {
          stroke-dasharray: 1300;
          stroke-dashoffset: 1300;
          animation: splashDrawC 1.1s cubic-bezier(0.33, 1, 0.68, 1) 0.8s forwards;
        }
        .splash-beat-stroke {
          stroke-dasharray: 700;
          stroke-dashoffset: 700;
          animation: splashDrawBeat 1.0s cubic-bezier(0.25, 1, 0.5, 1) 1.9s forwards;
        }
        .splash-dot-circle {
          transform-origin: 752px 528px;
          transform: scale(0);
          opacity: 0;
          animation: splashPopDot 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 2.9s forwards;
        }
        .splash-pulse-circle {
          transform-origin: 752px 528px;
          transform: scale(0);
          opacity: 0;
          animation: splashPulseRing 0.5s ease-out 2.95s forwards;
        }
      `}</style>

      {/* Centered logo scaled with clamp(180px, 28vw, 260px) */}
      <svg
        viewBox="0 0 1024 1024"
        style={{
          width: "clamp(180px, 28vw, 260px)",
          height: "clamp(180px, 28vw, 260px)",
        }}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* White C: starts at (704, 320) and traces anticlockwise to (704, 704) */}
        <path
          id="c"
          d="M704 320 A271 271 0 1 0 704 704"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="88"
          strokeLinecap="round"
          className="splash-c-stroke"
        />

        {/* Blue ECG heartbeat line: traces from left to right */}
        <path
          id="beat"
          d="M352 527 H432 L478 415 L543 640 L590 527 H720"
          fill="none"
          stroke="#6E95FF"
          strokeWidth="56"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="splash-beat-stroke"
        />

        {/* Soft pulse ring around the red dot */}
        <circle
          id="pulse"
          cx="752"
          cy="528"
          r="48"
          fill="none"
          stroke="#E04646"
          strokeWidth="10"
          className="splash-pulse-circle"
        />

        {/* Red dot popping at the end of the line */}
        <circle
          id="dot"
          cx="752"
          cy="528"
          r="48"
          fill="#E04646"
          className="splash-dot-circle"
        />
      </svg>
    </div>
  );
}
