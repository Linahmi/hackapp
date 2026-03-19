"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav
      className="w-full flex items-center justify-between px-6 py-3 no-print"
      style={{ backgroundColor: "var(--bg-app)", borderBottom: "1px solid var(--border-subtle)" }}
    >
      <div className="flex items-center gap-3">
        <span className="text-[color:var(--text-main)] font-bold text-lg tracking-tight select-none">
          ProcureTrace
        </span>
      </div>

      {/* Navigation Links */}
      <div className="hidden sm:flex items-center gap-4 absolute left-1/2 -translate-x-1/2">
        <Link 
          href="/" 
          className={`text-sm font-semibold transition-colors ${pathname === "/" ? "text-[color:var(--text-main)]" : "text-[color:var(--text-muted)] hover:opacity-70"}`}
        >
          Buyer Portal
        </Link>
        <Link
          href="/supplier"
          className={`text-sm font-semibold transition-colors ${(pathname === "/supplier" || pathname?.startsWith("/supplier-demo")) ? "text-[color:var(--text-main)]" : "text-[color:var(--text-muted)] hover:opacity-70"}`}
        >
          Supplier Portal
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </nav>
  );
}
