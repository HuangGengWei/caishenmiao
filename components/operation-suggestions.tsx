"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SignalRecord } from "@/lib/types";

interface OperationSuggestionsProps {
  records: SignalRecord[];
}

export function OperationSuggestions({ records }: OperationSuggestionsProps) {
  const suggestions = generateSuggestions(records);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground">
          今日操作建议
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {suggestions.map((s, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-foreground leading-relaxed"
            >
              <span className="inline-block w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex-shrink-0 flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-4 border-t border-border pt-3">
          以上建议仅基于信号数据统计分析，不构成投资建议。请结合盘面实际情况独立判断。
        </p>
      </CardContent>
    </Card>
  );
}

function generateSuggestions(records: SignalRecord[]): string[] {
  const suggestions: string[] = [];
  const highTurnover = records.filter((r) => r.turnover != null && r.turnover >= 8);
  const posPatternRecords = records.filter(
    (r) => r.sector_pattern === "水下拉水上"
  );

  if (posPatternRecords.length > 0) {
    suggestions.push(
      `共 ${posPatternRecords.length} 只出现「水下拉水上」板块分时形态，优先在次日开盘回踩VWAP附近低吸，不追涨。`
    );
  }

  if (highTurnover.length > 0) {
    suggestions.push(
      `换手率 > 8% 的品种共 ${highTurnover.length} 只，需警惕筹码松动，关注量价配合质量。`
    );
  }

  suggestions.push(
    "板块有多只股票同时出信号时，优先选龙头（换手合理+分时形态正面），避免分散。"
  );
  suggestions.push(
    "分时出现「急拉再狠砸」或「跌破VWAP回不去」的品种坚决回避。"
  );
  suggestions.push(
    "任何操作计划需设定止损位（建议-3%~-5%），严格执行纪律。"
  );

  return suggestions.slice(0, 8);
}
