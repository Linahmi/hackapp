"use client";

import { useEffect, useState } from "react";

type Status = "ok" | "violated" | "human";

interface CheckItem {
  status: Status;
  label: string;
  detail: string;
}

const CHECKS: CheckItem[] = [
  { status: "ok",       label: "Budget threshold",        detail: "Within approved limit"          },
  { status: "ok",       label: "Preferred supplier",      detail: "Dell on preferred vendor list"  },
  { status: "violated", label: "Delivery timeline",       detail: "2 weeks below 30-day minimum"   },
  { status: "human",    label: "Approval level",          detail: "Requires VP sign-off >250k CHF" },
  { status: "ok",       label: "Restricted supplier check", detail: "No sanctions matches found"   },
  { status: "violated", label: "Single-source rule",      detail: "3 quotes required above 100k"  },
];

const ICON: Record<Status, { symbol: string; color: string }> = {
  ok:       { symbol: "✓", color: "text-red-500"  },
  violated: { symbol: "✗", color: "text-red-500"  },
  human:    { symbol: "!", color: "text-white"     },
};

export default function PolicyCheck() {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (revealed >= CHECKS.length) return;
    const id = setTimeout(() => setRevealed((n) => n + 1), 180);
    return () => clearTimeout(id);
  }, [revealed]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className="rounded-xl p-6 flex flex-col gap-4"
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
              d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-white font-semibold text-base tracking-tight">
            Compliance Checks
          </span>
        </div>

        {/* Check list */}
        <div className="flex flex-col gap-2">
          {CHECKS.map((item, i) => {
            const { symbol, color } = ICON[item.status];
            const isVisible = i < revealed;
            return (
              <div
                key={item.label}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-300 ease-out ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                }`}
                style={{ backgroundColor: "#13161f", border: "1px solid #2a2f42" }}
              >
                <span className={`font-bold text-base w-4 shrink-0 ${color}`}>
                  {symbol}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-white text-sm font-medium leading-tight">
                    {item.label}
                  </span>
                  <span className="text-gray-500 text-xs mt-0.5 truncate">
                    {item.detail}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
