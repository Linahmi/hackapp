"use client";

import { useState } from "react";

interface Props {
  onAnalyze: () => void;
}

export default function RequestInput({ onAnalyze }: Props) {
  const [value, setValue] = useState("");

  return (
    <div className="w-full max-w-2xl flex flex-col gap-5">
      {/* Heading */}
      <div className="flex flex-col gap-1">
        <h1 className="text-white text-2xl font-bold tracking-tight">
          New Procurement Request
        </h1>
        <p className="text-gray-500 text-sm">
          Describe your need in plain language — quantity, location, timeline, budget.
        </p>
      </div>

      {/* Textarea */}
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Need 500 laptops for Geneva office, 2 weeks, budget 400k CHF..."
        rows={10}
        className="w-full resize-none rounded-lg px-5 py-4 text-white text-base leading-relaxed placeholder-gray-600 outline-none transition-all duration-200"
        style={{
          backgroundColor: "#13161f",
          border: "1px solid #2a2f42",
          boxShadow: "none",
        }}
        onFocus={(e) => {
          e.currentTarget.style.border = "1px solid #ef4444";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(239,68,68,0.12)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.border = "1px solid #2a2f42";
          e.currentTarget.style.boxShadow = "none";
        }}
      />

      {/* Submit */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => { console.log(value); onAnalyze(); }}
          className="w-full rounded-lg bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold text-base py-3 transition-colors duration-150 tracking-wide"
        >
          Analyze Request
        </button>
        <p className="text-gray-600 text-xs">Powered by ProcureTrace AI</p>
      </div>
    </div>
  );
}
