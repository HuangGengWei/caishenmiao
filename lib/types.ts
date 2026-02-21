export interface SignalRecord {
  date: string; // YYYY-MM-DD
  code: string;
  name: string;
  sector: string[];
  sector_pattern: "水下拉水上" | "波动三角收窄" | null;
  turnover: number | null;
  chg: number | null; // %
  amount: number | null;
  debt_ratio: number | null; // 资产负债率 %
  score: number;
  reason: string[];
}

export interface DailySummary {
  date: string;
  totalCount: number;
  highPriority: number; // score >= 75
  alternative: number; // score 50-74
  eliminated: number; // score < 50
  records: SignalRecord[];
}

export interface SectorStat {
  sector: string;
  count: number;
  topRecords: SignalRecord[];
  avgScore: number;
}

export interface StockHistory {
  code: string;
  name: string;
  sectors: string[];
  appearances: number;
  dates: string[];
  avgTurnover: number | null;
  avgScore: number;
  maxScore: number;
  noteSummary: string[];
}

// 每个「日期 + 板块」对应一张分时截图（Data URL）
export interface SectorScreenshot {
  date: string;   // YYYY-MM-DD
  sector: string; // 板块名称（需与 SignalRecord.sector 中一致）
  imageDataUrl: string;
}
