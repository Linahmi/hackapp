"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const [demoOn, setDemoOn] = useState(false);
  const pathname = usePathname();

  const toggleDemo = () => {
    const nextState = !demoOn;
    setDemoOn(nextState);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("toggleDemo", { detail: nextState }));
    }
  };

  return (
    <nav
      className="w-full flex items-center justify-between px-6 py-3"
      style={{ backgroundColor: "var(--bg-app)", borderBottom: "1px solid var(--border-subtle)" }}
    >
      <div className="flex items-center gap-3">
        <span className="text-[color:var(--text-main)] font-bold text-lg tracking-tight select-none">
          ProcureTrace
        </span>
        <span style={{ color: "var(--text-muted)" }}>|</span>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: "#dc2626" }}
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{ backgroundColor: "#dc2626" }}
            />
          </span>
          <span className="text-sm font-medium" style={{ color: "#dc2626" }}>
            Agent ready
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex items-center gap-1">
        <Link
          href="/"
          className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            pathname === "/"
              ? "text-[color:var(--text-main)] bg-white/10"
              : "text-[color:var(--text-muted)] hover:text-[color:var(--text-main)] hover:bg-white/5"
          }`}
        >
          Buyer Portal
        </Link>
        <Link
          href="/supplier"
          className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            pathname?.startsWith("/supplier")
              ? "text-[color:var(--text-main)] bg-white/10"
              : "text-[color:var(--text-muted)] hover:text-[color:var(--text-main)] hover:bg-white/5"
          }`}
        >
          Supplier Portal
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleDemo}
          className="text-xs px-3 py-1.5 rounded-full font-semibold transition-colors border"
          style={{
            backgroundColor: demoOn ? "rgba(220,38,38,0.15)" : "transparent",
            color: demoOn ? "#ef4444" : "var(--text-muted)",
            borderColor: demoOn ? "rgba(220,38,38,0.4)" : "var(--text-muted)"
          }}
        >
          Demo Mode: {demoOn ? "ON" : "OFF"}
        </button>
        <ThemeToggle />
      </div>
    </nav>
  );
}
