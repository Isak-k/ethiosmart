import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface LiquidBackdropProps {
  className?: string;
  showDroplets?: boolean;
  showSplash?: boolean;
  showRipples?: boolean;
  interactive?: boolean;
  variant?: "auth" | "dashboard" | "hero";
}

export function LiquidBackdrop({
  className,
  showDroplets = true,
  showSplash = true,
  showRipples = true,
  interactive = true,
  variant = "auth",
}: LiquidBackdropProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0.5, y: 0.5 });
  const [smoothPos, setSmoothPos] = useState({ x: 0.5, y: 0.5 });
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!interactive) return;

    let targetX = 0.5;
    let targetY = 0.5;
    let currentX = 0.5;
    let currentY = 0.5;

    const handlePointerMove = (e: PointerEvent) => {
      const { innerWidth, innerHeight } = window;
      if (innerWidth > 0 && innerHeight > 0) {
        targetX = Math.max(0, Math.min(1, e.clientX / innerWidth));
        targetY = Math.max(0, Math.min(1, e.clientY / innerHeight));
        setCursorPos({ x: targetX, y: targetY });
      }
    };

    // Smooth interpolation loop (60fps)
    const updateMotion = () => {
      // Lerp with 0.08 damping for fluid water momentum
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      setSmoothPos({ x: currentX, y: currentY });
      animFrameRef.current = requestAnimationFrame(updateMotion);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    animFrameRef.current = requestAnimationFrame(updateMotion);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [interactive]);

  // Compute slight parallax offset for 3D liquid depth
  const parallaxX = (smoothPos.x - 0.5) * 28;
  const parallaxY = (smoothPos.y - 0.5) * 28;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden select-none transition-colors duration-500",
        // Responsive Light / Dark Mode Liquid Glass Canvas Base
        "bg-gradient-to-b from-[#f2f7fe] via-[#f8fbff] to-[#e8f2fe] dark:from-[#050b16] dark:via-[#09152b] dark:to-[#040812]",
        className
      )}
    >
      {/* 1. Dynamic Cursor-Follow Liquid Caustic Spotlight (Movement with Cursor) */}
      {interactive && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-700"
          style={{
            background: `radial-gradient(700px circle at ${smoothPos.x * 100}% ${smoothPos.y * 100}%, rgba(56, 189, 248, 0.22) 0%, rgba(14, 165, 233, 0.1) 40%, transparent 75%)`,
          }}
        />
      )}

      {/* 2. Concentric Liquid Ripple Rings (Matching Reference Mockup Exactly) */}
      {showRipples && (
        <>
          {/* Top-Left Concentric Glass Ripple Plate */}
          <div
            className="absolute rounded-full border border-sky-300/40 dark:border-sky-400/20 backdrop-blur-[3px] transition-transform duration-700 ease-out"
            style={{
              width: "clamp(340px, 50vw, 680px)",
              height: "clamp(340px, 50vw, 680px)",
              top: "-15%",
              left: "-12%",
              transform: `translate3d(${parallaxX * 0.6}px, ${parallaxY * 0.6}px, 0)`,
              background:
                "radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.45) 0%, rgba(224, 242, 254, 0.18) 60%, transparent 100%)",
              boxShadow:
                "inset 0 3px 6px rgba(255, 255, 255, 0.9), 0 20px 45px -10px rgba(2, 132, 199, 0.12)",
            }}
          />

          {/* Top-Right Floating Frosted Glass Orb (Matching Mockup Right Sphere) */}
          <div
            className="absolute rounded-full border border-sky-200/50 dark:border-sky-400/20 backdrop-blur-md transition-transform duration-700 ease-out animate-float-droplet"
            style={{
              width: "clamp(100px, 16vw, 200px)",
              height: "clamp(100px, 16vw, 200px)",
              top: "22%",
              right: "4%",
              transform: `translate3d(${parallaxX * -0.8}px, ${parallaxY * -0.8}px, 0)`,
              background:
                "radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.85) 0%, rgba(224, 242, 254, 0.4) 45%, rgba(186, 230, 253, 0.2) 100%)",
              boxShadow:
                "inset 0 2px 4px rgba(255, 255, 255, 0.95), 0 16px 36px -6px rgba(2, 132, 199, 0.2)",
            }}
          />

          {/* Bottom-Right Sweeping Liquid Crest (Matching Mockup Bottom Wave) */}
          <div
            className="absolute rounded-full border border-sky-300/40 dark:border-sky-400/20 backdrop-blur-[4px] transition-transform duration-700 ease-out"
            style={{
              width: "clamp(360px, 55vw, 750px)",
              height: "clamp(360px, 55vw, 750px)",
              bottom: "-20%",
              right: "-15%",
              transform: `translate3d(${parallaxX * -0.6}px, ${parallaxY * -0.6}px, 0)`,
              background:
                "radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.5) 0%, rgba(186, 230, 253, 0.25) 50%, transparent 100%)",
              boxShadow:
                "inset 0 3px 6px rgba(255, 255, 255, 0.9), 0 25px 60px -12px rgba(2, 132, 199, 0.16)",
            }}
          />

          {/* Bottom-Left Liquid Ripple Arc */}
          <div
            className="absolute rounded-full border border-sky-200/40 dark:border-sky-400/15 transition-transform duration-700 ease-out"
            style={{
              width: "clamp(220px, 32vw, 420px)",
              height: "clamp(220px, 32vw, 420px)",
              bottom: "-10%",
              left: "-8%",
              transform: `translate3d(${parallaxX * 0.7}px, ${parallaxY * 0.7}px, 0)`,
              background:
                "radial-gradient(circle at 45% 45%, rgba(255, 255, 255, 0.4) 0%, rgba(224, 242, 254, 0.15) 60%, transparent 100%)",
              boxShadow: "inset 0 2px 4px rgba(255, 255, 255, 0.8)",
            }}
          />
        </>
      )}

      {/* 3. Fluid Organic Waves SVG */}
      <svg
        className="absolute inset-0 w-full h-full preserve-3d transition-opacity duration-700"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="liquid-flow-1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#e0f2fe" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#f0f9ff" stopOpacity="0.05" />
          </linearGradient>

          <linearGradient id="liquid-flow-dark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0c4a6e" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#082f49" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#030712" stopOpacity="0.05" />
          </linearGradient>

          <radialGradient id="liquid-splash-grad-motion" cx="45%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.65" />
            <stop offset="50%" stopColor="#0284c7" stopOpacity="0.45" />
            <stop offset="85%" stopColor="#0369a1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </radialGradient>
        </defs>

        <path
          className="fill-[url(#liquid-flow-1)] dark:fill-[url(#liquid-flow-dark)] transition-all duration-700"
          d="M0,0 C380,120 540,40 820,130 C1100,220 1280,80 1440,160 L1440,0 Z"
        />

        <path
          className="fill-[url(#liquid-flow-1)] dark:fill-[url(#liquid-flow-dark)] transition-all duration-700 opacity-60"
          d="M0,720 C320,640 580,780 920,700 C1220,620 1340,760 1440,710 L1440,900 L0,900 Z"
        />
      </svg>

      {/* 4. Fluid Splash Silhouette Behind Center (Matching Image 1) */}
      {showSplash && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[480px] h-[340px] sm:h-[480px] opacity-75 dark:opacity-40 transition-transform duration-700 ease-out"
          style={{
            transform: `translate3d(calc(-50% + ${parallaxX * 0.4}px), calc(-50% + ${parallaxY * 0.4}px), 0)`,
          }}
        >
          {/* Cyan/Blue liquid caustic blur aura */}
          <div className="absolute -inset-6 bg-gradient-to-tr from-sky-400/35 via-blue-500/25 to-teal-400/20 rounded-[40%_60%_70%_30%/40%_50%_60%_55%] blur-2xl animate-float" />
          
          <svg
            className="w-full h-full drop-shadow-[0_15px_35px_rgba(2,132,199,0.3)] animate-float"
            viewBox="0 0 500 500"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M389.5 132.5C437.5 186.5 448 274.5 417 348.5C386 422.5 313.5 482.5 233 487C152.5 491.5 64 440.5 33 365C2 289.5 28.5 189.5 86.5 125.5C144.5 61.5 234 33.5 316.5 61C399 88.5 341.5 78.5 389.5 132.5Z"
              fill="url(#liquid-splash-grad-motion)"
            />
            <path
              d="M350 110C390 150 420 220 395 310"
              stroke="rgba(255, 255, 255, 0.75)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="20 120"
            />
          </svg>
        </div>
      )}

      {/* 5. Floating 3D Water Droplets with Realistic Caustic Meniscus */}
      {showDroplets && (
        <>
          <div
            className="liquid-droplet w-9 h-9 sm:w-12 sm:h-12 top-[12%] left-[8%] sm:left-[16%] animate-float-droplet"
            style={{
              animationDelay: "0s",
              animationDuration: "5s",
              transform: `translate3d(${parallaxX * 0.9}px, ${parallaxY * 0.9}px, 0)`,
            }}
          />
          <div
            className="liquid-droplet w-4 h-4 sm:w-5 sm:h-5 top-[8%] left-[48%] animate-float-droplet"
            style={{
              animationDelay: "1.2s",
              animationDuration: "4s",
              transform: `translate3d(${parallaxX * 1.1}px, ${parallaxY * 1.1}px, 0)`,
            }}
          />
          <div
            className="liquid-droplet w-7 h-7 sm:w-8 sm:h-8 top-[14%] right-[10%] sm:right-[18%] animate-float-droplet"
            style={{
              animationDelay: "2.4s",
              animationDuration: "6s",
              transform: `translate3d(${parallaxX * -0.9}px, ${parallaxY * -0.9}px, 0)`,
            }}
          />
          <div
            className="liquid-droplet w-5 h-5 sm:w-6 sm:h-6 top-[46%] left-[4%] sm:left-[10%] animate-float-droplet"
            style={{
              animationDelay: "0.8s",
              animationDuration: "4.5s",
              transform: `translate3d(${parallaxX * 0.7}px, ${parallaxY * 0.7}px, 0)`,
            }}
          />
          <div
            className="liquid-droplet w-6 h-6 sm:w-7 sm:h-7 top-[52%] right-[5%] sm:right-[12%] animate-float-droplet"
            style={{
              animationDelay: "1.8s",
              animationDuration: "5.5s",
              transform: `translate3d(${parallaxX * -0.7}px, ${parallaxY * -0.7}px, 0)`,
            }}
          />
          <div
            className="liquid-droplet w-8 h-8 sm:w-10 sm:h-10 bottom-[14%] right-[10%] sm:right-[16%] animate-float-droplet"
            style={{
              animationDelay: "3s",
              animationDuration: "6.5s",
              transform: `translate3d(${parallaxX * -1.2}px, ${parallaxY * -1.2}px, 0)`,
            }}
          />
          <div
            className="liquid-droplet w-6 h-6 sm:w-7 sm:h-7 bottom-[18%] left-[7%] sm:left-[14%] animate-float-droplet"
            style={{
              animationDelay: "2.1s",
              animationDuration: "4.8s",
              transform: `translate3d(${parallaxX * 1.2}px, ${parallaxY * 1.2}px, 0)`,
            }}
          />
        </>
      )}

      {/* 6. Soft Diffused Caustic Orbs */}
      <div
        className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-sky-400/20 dark:bg-sky-500/15 blur-3xl pointer-events-none transition-transform duration-700"
        style={{ transform: `translate3d(${parallaxX * 0.5}px, ${parallaxY * 0.5}px, 0)` }}
      />
      <div
        className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-blue-500/20 dark:bg-blue-600/15 blur-3xl pointer-events-none transition-transform duration-700"
        style={{ transform: `translate3d(${parallaxX * -0.5}px, ${parallaxY * -0.5}px, 0)` }}
      />
    </div>
  );
}
