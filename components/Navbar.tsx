"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogoClick = () => {
    sessionStorage.clear();
    localStorage.removeItem("buyer_request");
    window.location.href = "/";
  };

  return (
    <nav
      className="w-full flex items-center justify-between px-6 py-3 sticky top-0 z-50 backdrop-blur-md bg-opacity-90"
      style={{ backgroundColor: "var(--bg-app)", borderBottom: "1px solid var(--border-subtle)" }}
    >
      <div className="flex items-center gap-3">
        <button 
          onClick={handleLogoClick}
          className="text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 font-bold text-xl tracking-tight select-none cursor-pointer transition-colors"
        >
          ProcureTrace <span className="text-sm font-medium">by ChainIQ</span>
        </button>
      </div>

      {/* Navigation Links */}
      <div className="hidden sm:flex items-center gap-4 absolute left-1/2 -translate-x-1/2">
        <Link 
          href="/" 
          className={`text-sm font-semibold transition-colors ${pathname === "/" ? "text-[color:var(--text-main)]" : "text-[color:var(--text-muted)] hover:opacity-70"}`}
        >
          Client Portal
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
        <Link
          href="/dashboard"
          className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            pathname?.startsWith("/dashboard")
              ? "text-[color:var(--text-main)] bg-white/10"
              : "text-[color:var(--text-muted)] hover:text-[color:var(--text-main)] hover:bg-white/5"
          }`}
        >
          Analytics
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </nav>
  );
}
