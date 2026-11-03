import React, { useRef, useState, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface LiquidTiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
  glareOpacity?: number;
}

export function LiquidTiltCard({
  children,
  className,
  maxTilt = 6,
  glareOpacity = 0.4,
  ...props
}: LiquidTiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transformStyle, setTransformStyle] = useState<string>("");
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, active: false });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only apply on hover capable pointers (desktop mice) to preserve smooth mobile touch
    if (window.matchMedia && !window.matchMedia("(hover: hover)").matches) return;

    const el = cardRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const normX = (x / rect.width - 0.5) * 2; // -1 to +1
    const normY = (y / rect.height - 0.5) * 2; // -1 to +1

    const rotX = -normY * maxTilt;
    const rotY = normX * maxTilt;

    setTransformStyle(
      `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateZ(4px)`
    );
    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      active: true,
    });
  };

  const handlePointerLeave = () => {
    setTransformStyle("perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)");
    setGlarePos((prev) => ({ ...prev, active: false }));
  };

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{
        transform: transformStyle,
        transformStyle: "preserve-3d",
      }}
      className={cn(
        "relative rounded-3xl transition-transform duration-200 ease-out will-change-transform",
        className
      )}
      {...props}
    >
      {/* Specular Liquid Glare Layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-inherit overflow-hidden transition-opacity duration-300 z-20"
        style={{
          opacity: glarePos.active ? glareOpacity : 0,
          background: `radial-gradient(circle 350px at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, 0.45) 0%, rgba(56, 189, 248, 0.15) 35%, transparent 70%)`,
        }}
      />
      {children}
    </div>
  );
}
