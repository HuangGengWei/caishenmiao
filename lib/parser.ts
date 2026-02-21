import type { SignalRecord } from "./types";
import { calculateScore } from "./scoring";

/**
 * Attempts to parse user-pasted text into SignalRecord[]
 * Supports multiple formats:
 * 1. Tab/comma separated table rows
 * 2. Semi-structured text with key=value or key:value
 * 3. JSON arrays
 */
export function parseSignalText(
  text: string,
  defaultDate?: string
): SignalRecord[] {
  const trimmed = text.trim();

  // Try JSON first
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      return arr.map((item: Record<string, unknown>) =>
        normalizeRecord(item, defaultDate)
      );
    } catch {
      // Fall through to text parsing
    }
  }

  // Try table format (tab or comma separated)
  const lines = trimmed.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];

  // Check if first line looks like a header
  const firstLine = lines[0].toLowerCase();
  const isHeader =
    firstLine.includes("代码") ||
    firstLine.includes("code") ||
    firstLine.includes("股票") ||
    firstLine.includes("名称");

  const dataLines = isHeader ? lines.slice(1) : lines;
  const records: SignalRecord[] = [];

  // Detect separator
  const separator = firstLine.includes("\t")
    ? "\t"
    : firstLine.includes("|")
      ? "|"
      : ",";

  // Try to parse headers if they exist
  let headers: string[] = [];
  if (isHeader) {
    headers = lines[0].split(separator).map((h) => h.trim().toLowerCase());
  }

  for (const line of dataLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (
      trimmedLine.includes(":") &&
      !trimmedLine.includes(",") &&
      !trimmedLine.includes("\t")
    ) {
      continue;
    }

    const parts = trimmedLine.split(separator).map((p) => p.trim());
    if (parts.length < 2) continue;

    const raw: Record<string, unknown> = {};

    if (headers.length > 0) {
      headers.forEach((h, i) => {
        if (i < parts.length) {
          const key = mapHeaderToKey(h);
          if (key) raw[key] = parts[i];
        }
      });
    } else {
      raw.code = extractCode(parts);
      raw.name = extractName(parts);
      raw.sector = extractSector(parts);
      raw.turnover = extractNumber(parts, /%/);
      raw.chg = extractChg(parts);
    }

    const record = normalizeRecord(raw, defaultDate);
    if (record.code || record.name) {
      records.push(record);
    }
  }

  // Try block format (separated by blank lines)
  if (records.length === 0) {
    const blocks = trimmed.split(/\n\s*\n/);
    for (const block of blocks) {
      const blockLines = block.split("\n").filter((l) => l.trim());
      const raw: Record<string, unknown> = {};

      for (const bline of blockLines) {
        const match = bline.match(/^(.+?)[：:]\s*(.+)$/);
        if (match) {
          const key = mapHeaderToKey(match[1].trim());
          if (key) raw[key] = match[2].trim();
        }
      }

      if (Object.keys(raw).length > 0) {
        const record = normalizeRecord(raw, defaultDate);
        if (record.code || record.name) {
          records.push(record);
        }
      }
    }
  }

  return records;
}

function mapHeaderToKey(header: string): string | null {
  const h = header.toLowerCase().trim();
  const map: Record<string, string> = {
    日期: "date",
    date: "date",
    代码: "code",
    股票代码: "code",
    code: "code",
    名称: "name",
    股票: "name",
    简称: "name",
    name: "name",
    股票简称: "name",
    板块: "sector",
    概念: "sector",
    sector: "sector",
    水下拉水上: "sector_pattern",
    波动三角收窄: "sector_pattern",
    板块分时: "sector_pattern",
    信号: "sector_pattern",
    换手率: "turnover",
    换手: "turnover",
    turnover: "turnover",
    触发时间: "trigger_time",
    时间: "trigger_time",
    trigger_time: "trigger_time",
    涨跌幅: "chg",
    涨幅: "chg",
    chg: "chg",
    成交额: "amount",
    amount: "amount",
    资产负债率: "debt_ratio",
    debt_ratio: "debt_ratio",
  };
  return map[h] || null;
}

function parseSectorPattern(
  val: unknown
): "水下拉水上" | "波动三角收窄" | null {
  const s = String(val || "").trim();
  if (s === "水下拉水上") return "水下拉水上";
  if (s === "波动三角收窄") return "波动三角收窄";
  // Legacy boolean support
  if (s === "true" || s === "是" || s === "1" || s === "yes") return "水下拉水上";
  return null;
}

function normalizeRecord(
  raw: Record<string, unknown>,
  defaultDate?: string
): SignalRecord {
  const date =
    (raw.date as string) || defaultDate || new Date().toISOString().slice(0, 10);
  const code = normalizeCode(raw.code as string);
  const name = ((raw.name as string) || "").trim();

  let sector: string[] = [];
  if (typeof raw.sector === "string") {
    sector = (raw.sector as string)
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (Array.isArray(raw.sector)) {
    sector = raw.sector as string[];
  }

  const sectorPattern = parseSectorPattern(raw.sector_pattern);
  const turnover =
    parseFloat(String(raw.turnover || "").replace("%", "")) || null;
  const chg = parseFloat(String(raw.chg || "").replace("%", "")) || null;
  const amount =
    parseFloat(String(raw.amount || "").replace(/[亿万,]/g, "")) || null;
  const partial: Partial<SignalRecord> = {
    sector_pattern: sectorPattern,
    turnover,
  };

  const { score, reason } = calculateScore(partial);

  return {
    date,
    code,
    name,
    sector,
    sector_pattern: sectorPattern,
    turnover,
    chg,
    amount,
    debt_ratio: parseFloat(String(raw.debt_ratio || "").replace("%", "")) || null,
    score,
    reason,
  };
}

function normalizeCode(code: unknown): string {
  if (!code) return "";
  return String(code).replace(/[^\d]/g, "").padStart(6, "0");
}

function extractCode(parts: string[]): string | undefined {
  return parts.find((p) => /^\d{6}$/.test(p.trim()));
}

function extractName(parts: string[]): string | undefined {
  return parts.find(
    (p) =>
      /^[\u4e00-\u9fa5A-Za-z]/.test(p.trim()) &&
      !/[%％]/.test(p) &&
      p.length <= 8
  );
}

function extractSector(parts: string[]): string | undefined {
  return parts.find(
    (p) =>
      p.includes("、") ||
      p.includes(",") ||
      (p.length > 4 && /[\u4e00-\u9fa5]/.test(p) && !/[%％]/.test(p))
  );
}

function extractNumber(parts: string[], hint?: RegExp): number | undefined {
  for (const p of parts) {
    if (hint && !hint.test(p)) continue;
    const n = parseFloat(p.replace(/[%％]/g, ""));
    if (!isNaN(n)) return n;
  }
  return undefined;
}

function extractChg(parts: string[]): number | undefined {
  for (const p of parts) {
    if (/[+-]?\d+\.\d+%?$/.test(p.trim())) {
      return parseFloat(p.replace(/[%％]/g, ""));
    }
  }
  return undefined;
}

