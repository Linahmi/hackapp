"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown } from "lucide-react"
import { BarChart, Bar, ResponsiveContainer, Cell } from "recharts"

const dailyRequests = [
  { day: "Mon", requests: 38 },
  { day: "Tue", requests: 52 },
  { day: "Wed", requests: 45 },
  { day: "Thu", requests: 61 },
  { day: "Fri", requests: 42 },
  { day: "Sat", requests: 28 },
  { day: "Sun", requests: 38 },
]

const kpiData = [
  {
    label: "Requests Processed",
    value: "304",
    trend: "+12%",
    trendDirection: "up" as const,
    badge: null,
  },
  {
    label: "Auto-Approved",
    value: "78%",
    trend: null,
    trendDirection: null,
    badge: { text: "Good", color: "bg-green-500/20 text-green-400" },
  },
  {
    label: "Escalated",
    value: "22%",
    trend: null,
    trendDirection: null,
    badge: { text: "High", color: "bg-red-500/20 text-red-400" },
  },
  {
    label: "Avg Savings",
    value: "14,200 EUR",
    trend: "-3%",
    trendDirection: "down" as const,
    badge: null,
  },
]

export function ProcurementAnalyticsWidget() {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-5">
        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpiData.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-lg bg-[#0f1117] p-4"
            >
              <p className="text-xs font-medium text-muted-foreground">
                {kpi.label}
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold text-white lg:text-2xl">
                  {kpi.value}
                </span>
                {kpi.trend && (
                  <span
                    className={`flex items-center text-xs font-medium ${
                      kpi.trendDirection === "up"
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {kpi.trendDirection === "up" ? (
                      <TrendingUp className="mr-0.5 h-3 w-3" />
                    ) : (
                      <TrendingDown className="mr-0.5 h-3 w-3" />
                    )}
                    {kpi.trend}
                  </span>
                )}
                {kpi.badge && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${kpi.badge.color}`}
                  >
                    {kpi.badge.text}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Sparkline Bar Chart */}
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Requests per Day (Last 7 Days)
            </p>
            <p className="text-xs text-muted-foreground">
              Total: <span className="font-medium text-white">304</span>
            </p>
          </div>
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyRequests} barCategoryGap="20%">
                <Bar dataKey="requests" radius={[3, 3, 0, 0]}>
                  {dailyRequests.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.requests > 50 ? "#dc2626" : "#3f4354"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex justify-between">
            {dailyRequests.map((day) => (
              <span
                key={day.day}
                className="flex-1 text-center text-[10px] text-muted-foreground"
              >
                {day.day}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
