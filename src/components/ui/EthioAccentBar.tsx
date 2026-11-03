import React from "react";
import { cn } from "@/lib/utils";

interface EthioAccentBarProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function EthioAccentBar({ className, size = "sm" }: EthioAccentBarProps) {
  const heightClass = size === "sm" ? "h-0.5" : size === "md" ? "h-1" : "h-1.5";
  return (
    <div
      className={cn("w-full flex overflow-hidden rounded-full opacity-90", heightClass, className)}
      aria-hidden="true"
    >
      <div className="flex-1 bg-emerald-500" />
      <div className="flex-1 bg-amber-400" />
      <div className="flex-1 bg-rose-500" />
    </div>
  );
}

export default EthioAccentBar;
