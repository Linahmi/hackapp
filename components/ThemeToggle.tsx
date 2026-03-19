"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Read from DOM on mount, default should be dark
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    if (html.classList.contains("dark")) {
      html.classList.remove("dark");
      setIsDark(false);
    } else {
      html.classList.add("dark");
      setIsDark(true);
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="ml-4 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 border"
      style={{
        backgroundColor: "var(--bg-hover)",
        color: "var(--text-main)",
        borderColor: "var(--border-subtle)"
      }}
      title="Toggle Theme"
    >
      {isDark ? "☀️ Light Mode" : "🌙 Dark Mode"}
    </button>
  );
}
