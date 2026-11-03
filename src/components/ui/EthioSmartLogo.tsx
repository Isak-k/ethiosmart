import React from "react";
import { cn } from "@/lib/utils";

export interface EthioSmartLogoProps {
  variant?: "full" | "compact" | "icon";
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  textColor?: "light" | "dark" | "auto";
  showTagline?: boolean;
  className?: string;
  badgeClassName?: string;
}

const sizeConfig = {
  xs: {
    badge: "h-7 w-7 rounded-lg",
    img: "h-7 w-7",
    title: "text-base",
    tagline: "text-[9px]",
  },
  sm: {
    badge: "h-9 w-9 rounded-xl",
    img: "h-9 w-9",
    title: "text-lg",
    tagline: "text-[10px]",
  },
  md: {
    badge: "h-11 w-11 rounded-2xl",
    img: "h-11 w-11",
    title: "text-xl",
    tagline: "text-[11px]",
  },
  lg: {
    badge: "h-14 w-14 rounded-2xl",
    img: "h-14 w-14",
    title: "text-2xl sm:text-3xl",
    tagline: "text-xs",
  },
  xl: {
    badge: "h-20 w-20 rounded-3xl",
    img: "h-20 w-20",
    title: "text-3xl sm:text-4xl",
    tagline: "text-sm",
  },
  "2xl": {
    badge: "h-24 w-24 sm:h-28 sm:w-28 rounded-3xl",
    img: "h-24 w-24 sm:h-28 sm:w-28",
    title: "text-4xl sm:text-5xl",
    tagline: "text-sm sm:text-base tracking-wider",
  },
};

export function EthioSmartLogo({
  variant = "compact",
  size = "md",
  textColor = "auto",
  showTagline = false,
  className,
  badgeClassName,
}: EthioSmartLogoProps) {
  const cfg = sizeConfig[size] || sizeConfig.md;
  const isFull = variant === "full" || showTagline;
  const isIconOnly = variant === "icon";

  const titleColorClass =
    textColor === "light"
      ? "text-white"
      : textColor === "dark"
      ? "text-slate-900"
      : "text-foreground";

  const taglineColorClass =
    textColor === "light"
      ? "text-cyan-200/90"
      : textColor === "dark"
      ? "text-sky-700"
      : "text-muted-foreground";

  return (
    <div className={cn("inline-flex items-center gap-2.5 sm:gap-3 select-none", className)}>
      {/* Official EthioSmart Badge */}
      <div
        className={cn(
          "relative shrink-0 overflow-hidden shadow-md shadow-blue-950/20 ring-1 ring-white/20 transition-transform duration-200",
          cfg.badge,
          badgeClassName
        )}
      >
        <img
          src="/EthioSmart-192.png"
          alt="EthioSmart Logo"
          className={cn("w-full h-full object-cover rounded-inherit", cfg.img)}
          loading="eager"
          decoding="async"
          onError={(e) => {
            // Fallback to high-res if 192 fails
            const target = e.currentTarget;
            if (target.src !== "/EthioSmart.png") {
              target.src = "/EthioSmart.png";
            }
          }}
        />
      </div>

      {/* Brand Text + Optional Tagline */}
      {!isIconOnly && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "font-display font-bold tracking-tight",
                titleColorClass,
                cfg.title
              )}
            >
              Ethio<span className="text-sky-500 dark:text-sky-400">Smart</span>
            </span>
          </div>
          {isFull && (
            <span
              className={cn(
                "font-medium tracking-wider uppercase mt-1 flex items-center gap-1",
                taglineColorClass,
                cfg.tagline
              )}
            >
              <span>Learn</span>
              <span className="text-sky-500 font-bold">•</span>
              <span>Practice</span>
              <span className="text-sky-500 font-bold">•</span>
              <span>Grow</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default EthioSmartLogo;
