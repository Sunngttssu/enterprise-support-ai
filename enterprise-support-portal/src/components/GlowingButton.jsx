import React from "react";

export default function GlowingButton({ children, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      style={{
        "--glow-color": "var(--bg-glass-heavy)",
        "--glow-color-via": "var(--bg-glass-medium)",
        "--glow-color-to": "transparent",
      }}
      className={`
        relative w-full h-[44px] px-5 text-[14px] font-[400] 
        rounded-xl border border-transparent 
        flex items-center justify-center 
        transition-all duration-300 overflow-hidden whitespace-nowrap
        bg-[var(--accent-gradient)] text-[var(--text-primary)]
        hover:opacity-90 active:scale-[0.98]
        /* The inner shadow overlay for depth */
        after:inset-0 after:absolute after:rounded-[inherit] 
        after:bg-gradient-to-r after:from-transparent after:from-30% 
        after:via-[var(--glow-color-via)] after:to-[var(--glow-color-to)] 
        after:via-70% after:z-20
        /* The glowing line block that slides across */
        before:absolute before:w-[6px] hover:before:translate-x-full 
        before:transition-transform before:duration-700 before:ease-in-out 
        before:h-[70%] before:bg-[var(--glow-color)] before:right-0 
        before:rounded-l-full before:shadow-[-2px_0_12px_var(--glow-color)] 
        before:z-10
        ${className}
      `}
    >
      <span className="relative z-30 flex items-center justify-center gap-2">
        {children}
      </span>
      {/* Gloss border */}
      <div 
        className="absolute inset-0 rounded-[inherit] border border-[var(--border-medium)] z-40 pointer-events-none transition-colors duration-300"
      />
    </button>
  );
}
