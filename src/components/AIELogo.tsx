import React from "react";

/**
 * AIE Logo component.
 * Uses the actual uploaded image file from /aie-logo.png.
 * Falls back to SVG if the image fails to load.
 */
export function AIELogo({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const dims = { sm: 32, md: 40, lg: 56, xl: 80 };
  const d = dims[size];

  return (
    <img
      src="/aie-logo.png"
      alt="AIE — Agile Intelligence Engine"
      width={d}
      height={d}
      className={`object-contain ${className}`}
      onError={(e) => {
        // If the PNG is missing, show the SVG fallback
        const target = e.currentTarget;
        target.style.display = "none";
        const fallback = target.nextElementSibling as HTMLElement;
        if (fallback) fallback.style.display = "block";
      }}
    />
  );
}

export function AIELogoFull({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <AIELogo size="lg" />
      <div className="flex flex-col">
        <span className="text-lg font-extrabold tracking-[0.2em] text-foreground">
          AIE
        </span>
        <span className="text-[8px] font-medium tracking-[0.15em] text-muted-foreground uppercase -mt-0.5">
          Agile Intelligence Engine
        </span>
      </div>
    </div>
  );
}
