"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SectorStat } from "@/lib/types";

interface SectorPanelProps {
  sectors: SectorStat[];
}

export function SectorPanel({ sectors }: SectorPanelProps) {
  if (sectors.length === 0) {
    return null;
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground">
          板块聚合
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {sectors.map((s) => (
            <div
              key={s.sector}
              className="rounded-lg border border-border bg-secondary/50 p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-primary-foreground text-lg px-4 py-2.5 rounded-lg bg-gradient-to-r from-primary to-primary/80 border-2 border-primary/60 shadow-md">
                  {s.sector}
                </h4>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                    {s.count} 次
                  </Badge>
                  <span className="text-xs font-mono text-primary">
                    avg {s.avgScore}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {s.topRecords.map((r, i) => (
                  <div
                    key={`${r.code}-${i}`}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-4">
                        {i + 1}.
                      </span>
                      <span className="font-mono text-foreground">
                        {r.code}
                      </span>
                      <span className="text-foreground">{r.name}</span>
                    </div>
                    <span
                      className={`font-mono font-bold ${
                        r.score >= 75
                          ? "text-stock-up"
                          : r.score >= 50
                            ? "text-primary"
                            : "text-stock-down"
                      }`}
                    >
                      {r.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
