"use client";

import { useEffect, useState } from "react";

const MOCK = [
  { icon: "🖥️", label: "Product", value: "Laptops" },
  { icon: "📦", label: "Quantity", value: "500 units" },
  { icon: "📍", label: "Location", value: "Geneva" },
  { icon: "💰", label: "Budget", value: "400k CHF" },
];

export default function RequestInterpretation() {
  const [visible, setVisible] = useState(false);

  // Trigger fade-in on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={`w-full max-w-2xl mx-auto transition-all duration-500 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
    >
      <div
        className="rounded-xl p-6 flex flex-col gap-5"
        style={{ backgroundColor: "#1e2130", border: "1px solid #2a2f42" }}
      >
        {/* Title */}
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-red-500 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-white font-semibold text-base tracking-tight">
            Request Interpreted
          </span>
        </div>

        {/* Chips */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MOCK.map(({ icon, label, value }) => (
            <div
              key={label}
              className="flex flex-col gap-1 rounded-lg px-4 py-3"
              style={{ backgroundColor: "#13161f", border: "1px solid #2a2f42" }}
            >
              <span className="text-lg leading-none">{icon}</span>
              <span className="text-gray-500 text-xs uppercase tracking-wider mt-1">
                {label}
              </span>
              <span className="text-white text-sm font-semibold">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
