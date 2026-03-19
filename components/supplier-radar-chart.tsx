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
          <PolarGrid stroke="#2d3140" strokeWidth={1} />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: "#ffffff", fontSize: 13, fontWeight: 500 }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "#9ca3af", fontSize: 11 }}
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
              backgroundColor: "#1a1d26",
              border: "1px solid #2d3140",
              borderRadius: "8px",
              color: "#ffffff",
            }}
            labelStyle={{ color: "#ffffff", fontWeight: 600 }}
            itemStyle={{ color: "#9ca3af" }}
          />
          <Legend
            wrapperStyle={{
              paddingTop: "20px",
            }}
            formatter={(value) => (
              <span style={{ color: "#ffffff", fontSize: "14px" }}>{value}</span>
            )}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
