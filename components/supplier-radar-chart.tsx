"use client"

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts"

const supplierData = [
  { axis: "Price", Bechtle: 85, "HP Enterprise": 72, Dell: 78 },
  { axis: "Risk", Bechtle: 70, "HP Enterprise": 85, Dell: 80 },
  { axis: "ESG", Bechtle: 90, "HP Enterprise": 75, Dell: 82 },
  { axis: "Delivery", Bechtle: 75, "HP Enterprise": 88, Dell: 85 },
  { axis: "Quality", Bechtle: 82, "HP Enterprise": 90, Dell: 87 },
]

const supplierColors = {
  Bechtle: "#dc2626",
  "HP Enterprise": "#3b82f6",
  Dell: "#22c55e",
}

export function SupplierRadarChart() {
  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={supplierData}>
          <PolarGrid stroke="var(--border-card)" strokeWidth={1} />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: "var(--text-main)", fontSize: 13, fontWeight: 600 }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickCount={5}
            axisLine={false}
          />
          <Radar
            name="Bechtle"
            dataKey="Bechtle"
            stroke={supplierColors.Bechtle}
            fill={supplierColors.Bechtle}
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Radar
            name="HP Enterprise"
            dataKey="HP Enterprise"
            stroke={supplierColors["HP Enterprise"]}
            fill={supplierColors["HP Enterprise"]}
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Radar
            name="Dell"
            dataKey="Dell"
            stroke={supplierColors.Dell}
            fill={supplierColors.Dell}
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-card)",
              borderRadius: "12px",
              color: "var(--text-main)",
              padding: "12px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
            }}
            labelStyle={{ color: "var(--text-main)", fontWeight: 700, marginBottom: "8px" }}
            itemStyle={{ color: "var(--text-muted)", fontWeight: 600, paddingBottom: "4px" }}
          />
          <Legend
            wrapperStyle={{
              paddingTop: "20px",
            }}
            formatter={(value) => (
              <span className="font-semibold text-sm transition-colors duration-300" style={{ color: "var(--text-muted)" }}>{value}</span>
            )}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
