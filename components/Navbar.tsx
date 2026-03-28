"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogoClick = () => {
    sessionStorage.clear();
    localStorage.removeItem("buyer_request");
    window.location.href = "/";
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const linkClass = (href: string) =>
    `text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${
      pathname?.startsWith(href)
        ? "text-[color:var(--text-main)] bg-white/10"
        : "text-[color:var(--text-muted)] hover:text-[color:var(--text-main)] hover:bg-white/5"
    }`;

  return (
    <nav
      className="w-full flex items-center justify-between px-6 py-3 sticky top-0 z-50 backdrop-blur-md bg-opacity-90"
      style={{ backgroundColor: "var(--bg-app)", borderBottom: "1px solid var(--border-subtle)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleLogoClick}
          className="text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 font-bold text-xl tracking-tight select-none cursor-pointer transition-colors"
        >
          ProcureTrace <span className="text-sm font-medium">by ChainIQ</span>
        </button>
      </div>

      {/* Nav links — centered */}
      <div className="hidden sm:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
        <Link
          href="/"
          className={`text-sm font-semibold transition-colors px-3 py-1.5 rounded-lg ${
            pathname === "/"
              ? "text-[color:var(--text-main)] bg-white/10"
              : "text-[color:var(--text-muted)] hover:text-[color:var(--text-main)] hover:bg-white/5"
          }`}
        >
          Client Portal
        </Link>
        <Link href="/supplier" className={linkClass("/supplier")}>
          Supplier Portal
        </Link>
        <Link href="/dashboard" className={linkClass("/dashboard")}>
          Analytics
        </Link>

        {/* Role-based links — only shown when logged in */}
        {(user?.role === "requester" || user?.role === "admin") && (
          <Link href="/my-requests" className={linkClass("/my-requests")}>
            My Requests
          </Link>
        )}
        {(user?.role === "manager" || user?.role === "admin") && (
          <Link href="/approvals" className={linkClass("/approvals")}>
            Approvals
          </Link>
        )}
      </div>

      {/* Right side — theme toggle + user */}
      <div className="flex items-center gap-3">
        <ThemeToggle />

        {user ? (
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: "var(--bg-hover)" }}>
              <User size={14} className="text-[color:var(--text-muted)]" />
              <span className="text-xs font-medium text-[color:var(--text-main)]">{user.name}</span>
              <span className="text-xs text-[color:var(--text-muted)] capitalize">{user.role}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[color:var(--text-muted)] hover:text-[color:var(--text-main)] hover:bg-white/5 transition-colors"
              title="Sign out"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
