"use client";

import React from "react";

export type Weights = {
  price: number;
  risk: number;
  lead_time: number;
  esg: number;
};

interface WeightSlidersProps {
  weights: Weights;
  onChange: (newWeights: Weights) => void;
}

export const WeightSliders: React.FC<WeightSlidersProps> = ({ weights, onChange }) => {
  const handleChange = (field: keyof Weights, value: string) => {
    const newVal = parseInt(value, 10);
    onChange({ ...weights, [field]: newVal });
  };

  const total = weights.price + weights.risk + weights.lead_time + weights.esg;

  return (
    <div className="bg-white dark:bg-[#12151f] border border-gray-200 dark:border-[#1e2130] rounded-2xl shadow-sm p-6 animate-slide-in-right">
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1 block">
            System Tuning
          </span>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Priority Weights</h2>
        </div>
        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${total === 100 ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20"}`}>
          Total: {total}%
        </div>
      </div>

      <div className="space-y-6">
        <Slider
          label="Price & TCO"
          value={weights.price}
          onChange={(v) => handleChange("price", v)}
          color="bg-red-500"
        />
        <Slider
          label="Vendor Risk"
          value={weights.risk}
          onChange={(v) => handleChange("risk", v)}
          color="bg-amber-500"
        />
        <Slider
          label="Lead Time"
          value={weights.lead_time}
          onChange={(v) => handleChange("lead_time", v)}
          color="bg-blue-500"
        />
        <Slider
          label="ESG & Sustainability"
          value={weights.esg}
          onChange={(v) => handleChange("esg", v)}
          color="bg-emerald-500"
        />
      </div>

      {total !== 100 && (
        <p className="mt-6 text-[10px] font-medium text-amber-600 dark:text-amber-500 italic text-center">
          Note: For optimal mathematical accuracy, weights should sum to 100%.
        </p>
      )}
    </div>
  );
};

const Slider = ({ label, value, onChange, color }: { label: string; value: number; onChange: (v: string) => void; color: string }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{label}</span>
      <span className="text-sm font-mono font-black text-gray-900 dark:text-white">{value}%</span>
    </div>
    <input
      type="range"
      min="0"
      max="100"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-white/10 accent-opacity-100`}
      style={{
           accentColor: color.match(/bg-(.*)/)?.[1] === 'red-500' ? '#ef4444' : 
                       color.match(/bg-(.*)/)?.[1] === 'amber-500' ? '#f59e0b' :
                       color.match(/bg-(.*)/)?.[1] === 'blue-500' ? '#3b82f6' : '#10b981'
      }}
    />
  </div>
);
