import type { SignalRecord } from "./types";

export function calculateScore(record: Partial<SignalRecord>): {
  score: number;
  reason: string[];
} {
  let score = 0;
  const reasons: string[] = [];

  // Base: sector_pattern
  if (record.sector_pattern === "水下拉水上") {
    score += 30;
    reasons.push("板块分时：水下拉水上 +30");
  } else if (record.sector_pattern === "波动三角收窄") {
    score += 20;
    reasons.push("板块分时：波动三角收窄 +20");
  } else if (record.sector_pattern === null || record.sector_pattern === undefined) {
    reasons.push("板块分时信息缺失");
  }

  // Turnover scoring
  if (record.turnover != null) {
    if (record.turnover >= 8) {
      score += 30;
      reasons.push(`换手率${record.turnover}% >= 8% +30`);
    } else if (record.turnover >= 5) {
      score += 20;
      reasons.push(`换手率${record.turnover}% >= 5% +20`);
    } else if (record.turnover >= 3) {
      score += 10;
      reasons.push(`换手率${record.turnover}% >= 3% +10`);
    }
  } else {
    reasons.push("换手率信息缺失");
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  if (reasons.length === 0) {
    reasons.push("信息不足/需补字段");
  }

  return { score, reason: reasons };
}
