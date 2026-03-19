"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("procuretrace_theme");
    if (saved) {
      const isDarkMode = saved === "dark";
      setIsDark(isDarkMode);
      if (isDarkMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    const newIsDark = !html.classList.contains("dark");
    if (newIsDark) {
      html.classList.add("dark");
      setIsDark(true);
    } else {
      html.classList.remove("dark");
      setIsDark(false);
    }
    localStorage.setItem("procuretrace_theme", newIsDark ? "dark" : "light");
  };

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative flex items-center h-8 w-16 rounded-full p-1 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-inner
        ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-200 border-gray-300'} border
      `}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      <span className="sr-only">Toggle Theme</span>
      <div 
        className={`flex items-center justify-center h-6 w-6 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${isDark ? 'translate-x-8' : 'translate-x-0'}`}
      >
        {isDark ? (
          <svg className="h-3.5 w-3.5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 2.32a1 1 0 011.415 0l.707.707a1 1 0 01-1.414 1.415l-.707-.708a1 1 0 010-1.414zm3.78 4.68a1 1 0 110 2h-1a1 1 0 110-2h1zM14.22 13.46a1 1 0 010 1.415l-.707.707a1 1 0 01-1.414-1.415l.707-.707a1 1 0 011.415 0zm-4.22 2.54a1 1 0 11-2 0v-1a1 1 0 112 0v1zM5.78 14.875a1 1 0 01-1.414 0l-.707-.707a1 1 0 011.414-1.415l.707.707a1 1 0 010 1.415zM4 10a1 1 0 11-2 0h1a1 1 0 112 0zm1.78-4.68a1 1 0 010-1.415l.707-.707a1 1 0 011.414 1.415l-.707.707a1 1 0 01-1.415 0zM10 5a5 5 0 100 10 5 5 0 000-10z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    </button>
  );
}
