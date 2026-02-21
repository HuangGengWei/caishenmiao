"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SignalRecord } from "@/lib/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ScoreChartProps {
  records: SignalRecord[];
}

export function ScoreChart({ records }: ScoreChartProps) {
  if (records.length === 0) return null;

  const sorted = [...records].sort((a, b) => b.score - a.score).slice(0, 15);

  const data = sorted.map((r) => ({
    name: r.name || r.code,
    score: r.score,
    code: r.code,
  }));

  function getBarColor(score: number) {
    if (score >= 75) return "hsl(145, 65%, 38%)";
    if (score >= 50) return "hsl(220, 70%, 50%)";
    return "hsl(0, 72%, 51%)";
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground">
          信号强度分布
          <span className="text-sm font-normal text-muted-foreground ml-2">
            (Top 15)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              layout="vertical"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(220, 13%, 90%)"
                horizontal={false}
              />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fill: "hsl(220, 10%, 46%)", fontSize: 11 }}
                axisLine={{ stroke: "hsl(220, 13%, 90%)" }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={70}
                tick={{ fill: "hsl(220, 20%, 14%)", fontSize: 11 }}
                axisLine={{ stroke: "hsl(220, 13%, 90%)" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(220, 13%, 90%)",
                  borderRadius: "6px",
                  color: "hsl(220, 20%, 14%)",
                  fontSize: 12,
                }}
                formatter={(value: number) => [`${value} 分`, "评分"]}
                labelFormatter={(label) => `${label}`}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={18}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={getBarColor(entry.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
