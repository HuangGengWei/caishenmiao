"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { DailySummary } from "@/lib/types";

interface OverviewCardsProps {
  summary: DailySummary;
}

export function OverviewCards({ summary }: OverviewCardsProps) {
  const cards = [
    {
      label: "今日信号总数",
      value: summary.totalCount,
      color: "text-foreground",
      bg: "bg-secondary",
    },
    {
      label: "重点关注",
      value: summary.highPriority,
      sub: null,
      color: "text-stock-up",
      bg: "bg-stock-up/10",
    },
    {
      label: "备选观察",
      value: summary.alternative,
      sub: null,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "剔除",
      value: summary.eliminated,
      sub: null,
      color: "text-stock-down",
      bg: "bg-stock-down/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <Card
          key={c.label}
          className={`border-border ${c.bg}`}
        >
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {c.label}
            </p>
            <p className={`text-3xl font-bold mt-1 ${c.color}`}>{c.value}</p>
            {c.sub && (
              <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
