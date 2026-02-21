"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SignalRecord } from "@/lib/types";

interface ReviewAIProps {
  records: SignalRecord[];
}

export function ReviewAI({ records }: ReviewAIProps) {
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    setSuggestion(null);
    setLoading(true);

    try {
      const dayRecords = records.filter((r) => r.date === date);

      const screenshotsRes = await fetch(
        `/api/sector-screenshots?date=${date}`
      );
      const sectorScreenshots =
        screenshotsRes.ok ? await screenshotsRes.json() : [];

      const res = await fetch("/api/ai/review-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          records: dayRecords,
          sectorScreenshots,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "请求失败");
        return;
      }

      setSuggestion(data.content || "");
    } catch (e: any) {
      setError(e?.message || "网络错误");
    } finally {
      setLoading(false);
    }
  }

  const dayRecords = records.filter((r) => r.date === date);
  const daySectorCount = new Set(dayRecords.flatMap((r) => r.sector)).size;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground">
          复盘智囊
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          基于当日板块分时图、个股数据生成操作建议
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground">选择日期</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40 bg-secondary text-foreground border-border"
          />
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="shrink-0"
          >
            {loading ? "生成中…" : "生成建议"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {date}：{dayRecords.length} 只个股，{daySectorCount} 个板块
          </span>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {suggestion && (
          <div className="rounded-lg border border-border bg-background/50 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              AI 操作建议
            </p>
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {suggestion}
            </div>
          </div>
        )}

        {!suggestion && !loading && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            选择日期后点击「生成建议」，将结合该日板块分时截图与个股数据给出操作建议
          </p>
        )}
      </CardContent>
    </Card>
  );
}
