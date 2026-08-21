import React from "react";

export function AIELogo({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const dims = { sm: 32, md: 40, lg: 56, xl: 80 };
  const d = dims[size];

  return (
    <svg
      viewBox="0 0 200 200"
      width={d}
      height={d}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="aie-blue-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a4a8a" />
          <stop offset="40%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="aie-arc" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="aie-swoosh" x1="20%" y1="50%" x2="80%" y2="50%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <filter id="aie-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Stylized "A" ─────────────────────────── */}
      {/* Left leg */}
      <path
        d="M 68 140 L 100 40 L 105 40 L 82 140 Z"
        fill="url(#aie-blue-grad)"
      />
      {/* Right leg */}
      <path
        d="M 100 40 L 132 140 L 118 140 L 105 60 L 100 40 Z"
        fill="#1e3a6e"
        opacity="0.9"
      />
      {/* Crossbar */}
      <path
        d="M 80 110 L 120 110 L 118 118 L 82 118 Z"
        fill="#2563eb"
        opacity="0.7"
      />

      {/* ── Swooping arc through the A ───────────── */}
      <path
        d="M 55 100 Q 90 55, 145 65 Q 160 68, 165 75"
        fill="none"
        stroke="url(#aie-swoosh)"
        strokeWidth="6"
        strokeLinecap="round"
        filter="url(#aie-glow)"
      />

      {/* ── Circuit network (right side) ──────────── */}
      <g stroke="#3b82f6" strokeWidth="1.5" fill="none" opacity="0.7">
        {/* Main arc */}
        <path d="M 140 55 Q 170 90, 155 130" />
        {/* Branch lines */}
        <path d="M 148 60 L 165 55" />
        <path d="M 160 80 L 178 75" />
        <path d="M 165 100 L 180 100" />
        <path d="M 160 120 L 175 128" />
      </g>
      {/* Circuit nodes */}
      <g fill="#60a5fa">
        <circle cx="148" cy="58" r="3" />
        <circle cx="163" cy="78" r="3" />
        <circle cx="168" cy="100" r="3" />
        <circle cx="158" cy="122" r="3" />
        <circle cx="165" cy="55" r="2.5" />
        <circle cx="178" cy="75" r="2.5" />
        <circle cx="180" cy="100" r="2.5" />
        <circle cx="175" cy="128" r="2.5" />
      </g>

      {/* ── "AIE" text ───────────────────────────── */}
      <text
        x="100"
        y="172"
        textAnchor="middle"
        fontFamily="'Inter', 'Segoe UI', system-ui, sans-serif"
        fontWeight="800"
        fontSize="32"
        letterSpacing="6"
        fill="url(#aie-blue-grad)"
      >
        AIE
      </text>

      {/* ── Tagline ──────────────────────────────── */}
      <line x1="25" y1="186" x2="60" y2="186" stroke="#3b82f6" strokeWidth="1" opacity="0.5" />
      <text
        x="100"
        y="190"
        textAnchor="middle"
        fontFamily="'Inter', 'Segoe UI', system-ui, sans-serif"
        fontWeight="500"
        fontSize="7"
        letterSpacing="3"
        fill="#60a5fa"
        opacity="0.7"
      >
        AGILE INTELLIGENCE ENGINE
      </text>
      <line x1="140" y1="186" x2="175" y2="186" stroke="#3b82f6" strokeWidth="1" opacity="0.5" />
    </svg>
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
