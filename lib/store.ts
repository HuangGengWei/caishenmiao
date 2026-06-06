import type {
  SignalRecord,
  DailySummary,
  SectorStat,
  StockHistory,
  SectorScreenshot,
} from "./types";

// ================= 信号记录相关（改为 API 调用）=================

// 获取所有记录
export async function getAllRecords(): Promise<SignalRecord[]> {
  try {
    const res = await fetch("/api/signals");
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMessage = errorData.error || `获取数据失败 (状态码: ${res.status})`;
      console.error("getAllRecords API error:", errorMessage, errorData);
      throw new Error(errorMessage);
    }
    return await res.json();
  } catch (error: any) {
    console.error("getAllRecords error:", error);
    // 不抛出错误，返回空数组，避免阻塞 UI
    return [];
  }
}

// 添加新记录（批量）
export async function addRecords(
  newRecords: SignalRecord[]
): Promise<SignalRecord[]> {
  try {
    const res = await fetch("/api/signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRecords),
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMessage = errorData.error || `保存数据失败 (状态码: ${res.status})`;
      console.error("addRecords API error:", errorMessage, errorData);
      throw new Error(errorMessage);
    }
    
    // 保存成功后重新获取所有记录
    return await getAllRecords();
  } catch (error: any) {
    console.error("addRecords error:", error);
    throw error; // 重新抛出错误，让调用者处理
  }
}

// 清空所有记录
export async function clearAllRecords(): Promise<void> {
  try {
    const res = await fetch("/api/signals", {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("清空数据失败");
  } catch (error) {
    console.error("clearAllRecords error:", error);
  }
}

// ================= 统计与导出（保持同步，基于内存数据）=================

export function getDailySummary(records: SignalRecord[]): DailySummary {
  const date = new Date().toISOString().slice(0, 10);
  return {
    date,
    totalCount: records.length,
    highPriority: records.filter((r) => r.score >= 75).length,
    alternative: records.filter((r) => r.score >= 50 && r.score < 75).length,
    eliminated: records.filter((r) => r.score < 50).length,
    records: records.sort((a, b) => b.score - a.score),
  };
}

export function getSectorStats(records: SignalRecord[]): SectorStat[] {
  const sectorMap = new Map<string, { count: number; records: SignalRecord[] }>();

  for (const r of records) {
    const tags = (r.tags || "").split(/,\s*/).filter(Boolean);
    for (const s of tags) {
      if (!sectorMap.has(s)) {
        sectorMap.set(s, { count: 0, records: [] });
      }
      const entry = sectorMap.get(s)!;
      entry.count++;
      entry.records.push(r);
    }
  }

  return Array.from(sectorMap.entries())
    .map(([sector, { count, records: recs }]) => ({
      sector,
      count,
      topRecords: recs.sort((a, b) => b.score - a.score).slice(0, 3),
      avgScore: Math.round(recs.reduce((s, r) => s + r.score, 0) / recs.length),
    }))
    .sort((a, b) => b.count - a.count);
}

export function getStockHistory(records: SignalRecord[]): StockHistory[] {
  const stockMap = new Map<string, SignalRecord[]>();

  for (const r of records) {
    if (!r.stock) continue;
    if (!stockMap.has(r.stock)) stockMap.set(r.stock, []);
    stockMap.get(r.stock)!.push(r);
  }

  return Array.from(stockMap.entries())
    .map(([, recs]) => {
      const turnovers = recs
        .map((r) => r.turnover)
        .filter((t): t is number => t !== null);
      const scores = recs.map((r) => r.score);
      const allTags = new Set(recs.flatMap((r) => (r.tags || "").split(/,\s*/).filter(Boolean)));

      return {
        stock: recs[0].stock,
        tags: Array.from(allTags),
        appearances: recs.length,
        avgTurnover:
          turnovers.length > 0
            ? Math.round(
                (turnovers.reduce((a, b) => a + b, 0) / turnovers.length) * 100
              ) / 100
            : null,
        avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        maxScore: Math.max(...scores),
        noteSummary: [],
      };
    })
    .sort((a, b) => b.appearances - a.appearances || b.avgScore - a.avgScore);
}

export function exportToCSV(records: SignalRecord[]): string {
  const headers = [
    "股票",
    "标签",
    "换手率%",
    "市值",
    "资产负债率%",
    "评分",
    "评分原因",
  ];
  const rows = records.map((r) => [
    r.stock,
    r.tags,
    r.turnover ?? "",
    r.amount ?? "",
    r.debt_ratio ?? "",
    r.score,
    r.reason.join("; "),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function exportToJSON(records: SignalRecord[]): string {
  return JSON.stringify(records, null, 2);
}

// ================= 板块分时截图相关（改为 API 调用）=================

// 上传/更新截图
export async function upsertSectorScreenshot(
  shot: SectorScreenshot
): Promise<void> {
  try {
    const res = await fetch("/api/sector-screenshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(shot),
    });
    if (!res.ok) throw new Error("保存截图失败");
  } catch (error) {
    console.error("upsertSectorScreenshot error:", error);
  }
}

// 读取单个「日期 + 板块」的截图
export async function getSectorScreenshot(
  date: string,
  sector: string
): Promise<SectorScreenshot | null> {
  try {
    const res = await fetch(
      `/api/sector-screenshots?date=${date}&sector=${encodeURIComponent(sector)}`
    );
    if (!res.ok) return null;
    const data: SectorScreenshot[] = await res.json();
    return data[0] || null;
  } catch (error) {
    console.error("getSectorScreenshot error:", error);
    return null;
  }
}

// 读取某天所有板块截图
export async function getSectorScreenshotsForDate(
  date: string
): Promise<SectorScreenshot[]> {
  try {
    const res = await fetch(`/api/sector-screenshots?date=${date}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("getSectorScreenshotsForDate error:", error);
    return [];
  }
}
