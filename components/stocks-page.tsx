"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CandlestickChart } from "@/components/candlestick-chart";
import type { SignalRecord, SectorScreenshot } from "@/lib/types";
import { getSectorScreenshot } from "@/lib/store";

interface StocksPageProps {
  records: SignalRecord[];
}

type SortKey =
  | "date"
  | "code"
  | "name"
  | "amount"
  | "debt_ratio"
  | "tradingDays"
  | "limitUpDays"
  | "maProximity"
  | "ma20Proximity";

interface OhlcPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Ma20Status {
  ma20: number | null;
  latestClose: number | null;
  latestHigh: number | null;
  latestTradeDate: string | null;
  status: "above" | "touched" | "below" | null;
  ohlc: OhlcPoint[];
  loading: boolean;
  error?: string;
}

interface DailyChartPoint {
  date: string;
  close: number;
  ma5: number | null;
  ma30: number | null;
}

interface Ma5Ma30Status {
  series: DailyChartPoint[];
  near: boolean | null;
  typicalNearMa30: boolean | null; // 当日分时均价（O/H/L/C 均价）与 30 日线是否接近
  latestTradeDate: string | null;
  loading: boolean;
  error?: string;
}

interface LimitUpInfo {
  limitUpDate: string | null;
  limitUpDates?: string[]; // 录入日前后涨停日期列表
  loading: boolean;
  error?: string;
}

/** 东方财富个股页 URL：沪 sh、深 sz、京 bj */
function eastmoneyQuoteUrl(code: string): string {
  const c = String(code).replace(/\D/g, "").padStart(6, "0");
  if (c.startsWith("6") || c.startsWith("5")) return `https://quote.eastmoney.com/sh${c}.html`;
  if (c.startsWith("4") || c.startsWith("8")) return `https://quote.eastmoney.com/bj${c}.html`;
  return `https://quote.eastmoney.com/sz${c}.html`;
}

export function StocksPage({ records }: StocksPageProps) {
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pageSize, setPageSize] = useState<"10" | "20" | "50" | "all">("10");
  const [pageIndex, setPageIndex] = useState(0);

  // 交易日历：存储所有已知交易日（YYYY-MM-DD），用于计算交易天数
  const [tradingDays, setTradingDays] = useState<string[]>([]);

  // MA20 数据：key = code
  const [ma20Map, setMa20Map] = useState<Record<string, Ma20Status>>({});
  // 最新数据日期（用于表头展示，取任一成功返回的 latestTradeDate）
  const [latestMa20DataDate, setLatestMa20DataDate] = useState<string | null>(null);

  // 5日/30日均线及是否接近：key = code
  const [ma5ma30Map, setMa5ma30Map] = useState<Record<string, Ma5Ma30Status>>({});
  const [latestMa5Ma30DataDate, setLatestMa5Ma30DataDate] = useState<string | null>(null);

  // 加载交易日历（近180天足够覆盖所有录入日期到今天）
  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date();
        const start = new Date(today);
        start.setDate(start.getDate() - 365);
        const fmt = (d: Date) =>
          `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
        const res = await fetch(
          `/api/tushare/trade-cal?startDate=${fmt(start)}&endDate=${fmt(today)}`
        );
        if (res.ok) {
          const data = await res.json();
          // trade-cal 返回 nonTradingDays；我们需要推算出所有交易日
          // 重新请求并获取全部日历（is_open=1 的日期）
          // 直接调用另一个端点更简单，但现有端点只返回非交易日
          // 所以我们自己枚举所有日期，排除非交易日
          const nonSet = new Set<string>(data.nonTradingDays || []);
          const days: string[] = [];
          const cur = new Date(start);
          while (cur <= today) {
            const iso = cur.toISOString().slice(0, 10);
            if (!nonSet.has(iso)) {
              days.push(iso);
            }
            cur.setDate(cur.getDate() + 1);
          }
          setTradingDays(days);
        }
      } catch {
        // 静默失败，交易天数显示 "-"
      }
    };
    load();
  }, []);

  // 计算某录入日期到今天（含今天）的交易天数
  const calcTradingDays = useCallback(
    (recordDate: string): number | null => {
      if (tradingDays.length === 0) return null;
      const today = new Date().toISOString().slice(0, 10);
      return tradingDays.filter((d) => d >= recordDate && d <= today).length;
    },
    [tradingDays]
  );

  // 录入日到目标日期的相对交易天数：目标晚于录入日为正(D+N)，早于录入日为负(D-N)，当日为 0
  const calcTradingDaysBetween = useCallback(
    (recordDate: string, targetDate: string): number | null => {
      if (tradingDays.length === 0) return null;
      if (targetDate === recordDate) return 0;
      if (targetDate > recordDate) {
        return tradingDays.filter((d) => d >= recordDate && d <= targetDate).length;
      }
      // 目标在录入日前：中间交易日个数取负，即 D-N
      const n = tradingDays.filter((d) => d > targetDate && d <= recordDate).length;
      return -n;
    },
    [tradingDays]
  );

  // 涨停信息
  const [limitUpMap, setLimitUpMap] = useState<Record<string, LimitUpInfo>>({});
  // 板块分时截图缓存 & 预览（使用右下角浮层展示）
  const sectorShotCache = useRef<Map<string, SectorScreenshot | null>>(new Map());
  const [hoverPreview, setHoverPreview] = useState<{ url: string; title: string } | null>(null);

  const fetchMa20 = useCallback(async (code: string) => {
    setMa20Map((prev) => ({
      ...prev,
      [code]: {
        ma20: null,
        latestClose: null,
        latestHigh: null,
        latestTradeDate: null,
        status: null,
        ohlc: [],
        loading: true,
      },
    }));
    try {
      const res = await fetch(`/api/tushare/ma20-chart?code=${code}`);
      const data = await res.json();
      if (!res.ok) {
        setMa20Map((prev) => ({
          ...prev,
          [code]: {
            ma20: null,
            latestClose: null,
            latestHigh: null,
            latestTradeDate: null,
            status: null,
            ohlc: [],
            loading: false,
            error: data.error || "获取失败",
          },
        }));
        return;
      }
      setMa20Map((prev) => ({
        ...prev,
        [code]: {
          ma20: data.ma20,
          latestClose: data.latestClose,
          latestHigh: data.latestHigh,
          latestTradeDate: data.latestTradeDate ?? null,
          status: data.status,
          ohlc: data.ohlc ?? [],
          loading: false,
        },
      }));
      if (data.latestTradeDate) {
        setLatestMa20DataDate((d) =>
          !d || data.latestTradeDate > d ? data.latestTradeDate : d
        );
      }
    } catch (e: any) {
      setMa20Map((prev) => ({
        ...prev,
        [code]: {
          ma20: null,
          latestClose: null,
          latestHigh: null,
          latestTradeDate: null,
          status: null,
          ohlc: [],
          loading: false,
          error: e?.message || "网络请求失败",
        },
      }));
    }
  }, []);

  const fetchDailyChart = useCallback(async (code: string) => {
    setMa5ma30Map((prev) => ({
      ...prev,
      [code]: {
        series: [],
        latestTradeDate: null,
        near: null,
        typicalNearMa30: null,
        loading: true,
      },
    }));
    try {
      const res = await fetch(`/api/tushare/daily-chart?code=${code}`);
      const data = await res.json();
      if (!res.ok) {
        setMa5ma30Map((prev) => ({
          ...prev,
          [code]: {
            series: [],
            latestTradeDate: null,
            near: null,
            typicalNearMa30: null,
            loading: false,
            error: data.error || "获取失败",
          },
        }));
        return;
      }
      const latestDate =
        data.series?.length > 0
          ? data.series[data.series.length - 1].date
          : null;
      setMa5ma30Map((prev) => ({
        ...prev,
        [code]: {
          series: data.series ?? [],
          near: data.near ?? false,
          typicalNearMa30: data.typicalNearMa30 ?? false,
          latestTradeDate: latestDate,
          loading: false,
        },
      }));
      if (latestDate) {
        setLatestMa5Ma30DataDate((d) =>
          !d || latestDate > d ? latestDate : d
        );
      }
    } catch (e: any) {
      setMa5ma30Map((prev) => ({
        ...prev,
        [code]: {
          series: [],
          latestTradeDate: null,
          near: null,
          typicalNearMa30: null,
          loading: false,
          error: e?.message || "网络请求失败",
        },
      }));
    }
  }, []);

  const fetchLimitUp = useCallback(
    async (code: string, recordDate: string) => {
      const key = `${code}-${recordDate}`;
      setLimitUpMap((prev) => ({
        ...prev,
        [key]: {
          limitUpDate: null,
          loading: true,
        },
      }));
      try {
        const params = new URLSearchParams({ code, recordDate, extended: "1" });
        const res = await fetch(`/api/tushare/limit-up?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          setLimitUpMap((prev) => ({
            ...prev,
            [key]: {
              limitUpDate: null,
              loading: false,
              error: data.error || "获取失败",
            },
          }));
          return;
        }
        setLimitUpMap((prev) => ({
          ...prev,
          [key]: {
            limitUpDate: data.limitUpDate ?? null,
            limitUpDates: data.limitUpDates ?? [],
            loading: false,
          },
        }));
      } catch (e: any) {
        setLimitUpMap((prev) => ({
          ...prev,
          [key]: {
            limitUpDate: null,
            loading: false,
            error: e?.message || "网络请求失败",
          },
        }));
      }
    },
    []
  );

  const allSectors = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      for (const s of r.sector) set.add(s);
    }
    return Array.from(set).sort();
  }, [records]);

  const filtered = useMemo(() => {
    let list = [...records];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.code.includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.sector.some((s) => s.toLowerCase().includes(q))
      );
    }

    if (sectorFilter !== "all") {
      list = list.filter((r) => r.sector.includes(sectorFilter));
    }

    list.sort((a, b) => {
      let av: string | number | null = null;
      let bv: string | number | null = null;
      switch (sortKey) {
        case "date":
          av = a.date;
          bv = b.date;
          break;
        case "code":
          av = a.code;
          bv = b.code;
          break;
        case "name":
          av = a.name;
          bv = b.name;
          break;
        case "amount":
          av = a.amount;
          bv = b.amount;
          break;
        case "debt_ratio":
          av = a.debt_ratio;
          bv = b.debt_ratio;
          break;
        case "tradingDays": {
          const ta = calcTradingDays(a.date);
          const tb = calcTradingDays(b.date);
          av = ta;
          bv = tb;
          break;
        }
        case "limitUpDays": {
          const getDays = (r: SignalRecord): number | null => {
            const info = limitUpMap[`${r.code}-${r.date}`];
            if (!info || info.loading || !info.limitUpDate) return null;
            return calcTradingDaysBetween(r.date, info.limitUpDate);
          };
          av = getDays(a);
          bv = getDays(b);
          break;
        }
        case "maProximity": {
          const getProximity = (r: SignalRecord): number | null => {
            const s = ma5ma30Map[r.code];
            if (!s || !s.series || s.series.length === 0) return null;
            const latest = s.series[s.series.length - 1];
            if (
              latest.ma5 == null ||
              latest.ma30 == null ||
              latest.ma5 <= 0 ||
              latest.ma30 <= 0
            ) {
              return null;
            }
            const minMa = Math.min(latest.ma5, latest.ma30);
            return Math.abs(latest.ma5 - latest.ma30) / minMa;
          };
          av = getProximity(a);
          bv = getProximity(b);
          break;
        }
        case "ma20Proximity": {
          const getProximity = (r: SignalRecord): number | null => {
            const s = ma20Map[r.code];
            if (!s || s.ma20 == null || s.latestClose == null || s.ma20 <= 0) return null;
            return Math.abs(s.latestClose - s.ma20) / s.ma20;
          };
          av = getProximity(a);
          bv = getProximity(b);
          break;
        }
      }
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [
    records,
    search,
    sectorFilter,
    sortKey,
    sortDir,
    calcTradingDays,
    calcTradingDaysBetween,
    limitUpMap,
    ma5ma30Map,
    ma20Map,
  ]);

  const visibleRecords = useMemo(() => {
    if (filtered.length === 0) return [];
    if (pageSize === "all") {
      return filtered;
    }
    const limit = Number(pageSize);
    const start = pageIndex * limit;
    const end = start + limit;
    return filtered.slice(start, end);
  }, [filtered, pageSize, pageIndex]);

  // 当过滤条件或页大小变化时，重置或校正页码
  useEffect(() => {
    setPageIndex(0);
  }, [search, sectorFilter, sortKey, sortDir, pageSize]);

  useEffect(() => {
    if (pageSize === "all") return;
    const limit = Number(pageSize);
    const totalPages = Math.max(1, Math.ceil(filtered.length / (limit || 1)));
    setPageIndex((prev) => Math.min(prev, totalPages - 1));
  }, [filtered.length, pageSize]);

  // 自动查询：
  // - 对当前展示记录触发 MA20 / MA5-MA30
  // - 当排序依据是“涨停天数”或“MA 接近程度”时，对过滤后的全集触发对应查询，保证排序基于全集数据
  const fetchedRef = useRef<Set<string>>(new Set());
  const fetchedMa5Ma30Ref = useRef<Set<string>>(new Set());
  const fetchedLimitUpRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const baseForMa =
      sortKey === "maProximity" || sortKey === "ma20Proximity" ? filtered : visibleRecords;
    const codes = Array.from(new Set(baseForMa.map((r) => r.code)));
    for (const code of codes) {
      if (!fetchedRef.current.has(code)) {
        fetchedRef.current.add(code);
        fetchMa20(code);
      }
      if (!fetchedMa5Ma30Ref.current.has(code)) {
        fetchedMa5Ma30Ref.current.add(code);
        fetchDailyChart(code);
      }
    }
    const baseForLimitUp = sortKey === "limitUpDays" ? filtered : visibleRecords;
    for (const r of baseForLimitUp) {
      const key = `${r.code}-${r.date}`;
      if (!fetchedLimitUpRef.current.has(key)) {
        fetchedLimitUpRef.current.add(key);
        fetchLimitUp(r.code, r.date);
      }
    }
  }, [visibleRecords, filtered, sortKey, fetchMa20, fetchDailyChart, fetchLimitUp]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // 涨停天数 & MA 接近程度都是“数值越小越好”，默认升序；其它默认降序
      setSortDir(
        key === "limitUpDays" || key === "maProximity" || key === "ma20Proximity"
          ? "asc"
          : "desc"
      );
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col)
      return <span className="ml-1 text-muted-foreground/40">↕</span>;
    return (
      <span className="ml-1 text-primary">
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  }

  function Ma20Cell({ code }: { code: string }) {
    const s = ma20Map[code];
    if (!s) {
      return <span className="text-xs text-muted-foreground">加载中…</span>;
    }
    if (s.loading) {
      return (
        <span className="text-xs text-muted-foreground animate-pulse">查询中…</span>
      );
    }
    if (s.error) {
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-destructive font-medium">查询失败</span>
          <span className="text-[10px] text-destructive/70 max-w-[140px] break-words leading-tight">
            {s.error}
          </span>
          <button
            onClick={() => fetchMa20(code)}
            className="text-[10px] text-primary underline-offset-2 hover:underline text-left mt-0.5"
          >
            重试
          </button>
        </div>
      );
    }
    if (s.ma20 === null && (!s.ohlc || s.ohlc.length === 0)) {
      return <span className="text-xs text-muted-foreground">-</span>;
    }
    const statusBadge =
      s.status === "above" ? (
        <Badge className="text-[10px] px-1.5 py-0 h-5 bg-stock-up/20 text-stock-up border border-stock-up/40 font-semibold">
          已上穿
        </Badge>
      ) : s.status === "touched" ? (
        <Badge className="text-[10px] px-1.5 py-0 h-5 bg-primary/20 text-primary border border-primary/40 font-semibold">
          触及
        </Badge>
      ) : s.status === "below" ? (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-muted-foreground">
          未达到
        </Badge>
      ) : null;
    const hasChart = s.ohlc && s.ohlc.length > 0;
    return (
      <div className="flex flex-col gap-0.5 min-w-[200px]">
        {hasChart ? (
          <CandlestickChart
            data={s.ohlc}
            ma20={s.ma20}
            width={200}
            height={56}
            className="shrink-0"
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-foreground font-semibold">
              {s.ma20 != null ? s.ma20.toFixed(2) : "-"}
            </span>
            {statusBadge}
          </div>
        )}
        {hasChart && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {statusBadge}
            {s.ma20 != null && (
              <span className="text-[10px] text-muted-foreground font-mono">
                MA20 {s.ma20.toFixed(2)}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  /** 涨停情况：以录入日为中心，显示多个涨停日期及相对天数（正数=录入日后，负数=录入日前） */
  function LimitUpCell({ code, recordDate }: { code: string; recordDate: string }) {
    const key = `${code}-${recordDate}`;
    const info = limitUpMap[key];
    if (!info) {
      return <span className="text-xs text-muted-foreground">加载中…</span>;
    }
    if (info.loading) {
      return <span className="text-xs text-muted-foreground animate-pulse">查询中…</span>;
    }
    if (info.error) {
      return (
        <span className="text-[10px] text-destructive" title={info.error}>
          查询失败
        </span>
      );
    }
    const dates = info.limitUpDates ?? [];
    if (dates.length === 0) {
      return <span className="text-xs text-muted-foreground">暂无涨停</span>;
    }
    const before: string[] = [];
    const record: string[] = [];
    const after: string[] = [];
    for (const d of dates) {
      const days = calcTradingDaysBetween(recordDate, d);
      if (days === null) continue;
      if (days < 0) before.push(d);
      else if (days === 0) record.push(d);
      else after.push(d);
    }
    before.sort((a, b) => a.localeCompare(b));
    record.sort((a, b) => a.localeCompare(b));
    after.sort((a, b) => a.localeCompare(b));

    const renderTag = (
      d: string,
      dayLabel: string,
      style: "before" | "record" | "after"
    ) => {
      const isRecord = style === "record";
      const classMap = {
        before:
          "inline-flex flex-col items-start text-[10px] font-mono rounded px-1.5 py-0.5 border border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-400",
        record:
          "inline-flex flex-col items-start text-[10px] font-mono rounded px-1.5 py-0.5 border-2 border-primary bg-primary/20 text-primary font-semibold ring-1 ring-primary/30",
        after:
          "inline-flex flex-col items-start text-[10px] font-mono rounded px-1.5 py-0.5 border border-stock-up/50 bg-stock-up/15 text-stock-up",
      };
      return (
        <span
          key={d}
          className={classMap[style]}
          title={isRecord ? `${d}（录入日）` : d}
        >
          <span>{d.slice(5)}</span>
          {dayLabel !== "" && <span className="font-semibold">{dayLabel}</span>}
        </span>
      );
    };

    const Divider = () => (
      <span
        className="self-stretch w-px min-h-6 border-l border-dashed border-border mx-1 shrink-0"
        aria-hidden
      />
    );

    return (
      <div className="flex flex-wrap items-center gap-1 min-w-[140px]">
        {before.length > 0 && (
          <>
            <div className="flex flex-wrap gap-1.5 items-baseline">
              {before.map((d) =>
                renderTag(d, `D${calcTradingDaysBetween(recordDate, d)}`, "before")
              )}
            </div>
            {(record.length > 0 || after.length > 0) && <Divider />}
          </>
        )}
        {record.length > 0 && (
          <>
            <div className="flex flex-wrap gap-1.5 items-baseline">
              {record.map((d) => renderTag(d, "录入日", "record"))}
            </div>
            {after.length > 0 && <Divider />}
          </>
        )}
        {after.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-baseline">
            {after.map((d) =>
              renderTag(d, `D+${calcTradingDaysBetween(recordDate, d)}`, "after")
            )}
          </div>
        )}
      </div>
    );
  }

  function Ma5Ma30Cell({ code }: { code: string }) {
    const s = ma5ma30Map[code];
    if (!s) {
      return <span className="text-xs text-muted-foreground">加载中…</span>;
    }
    if (s.loading) {
      return (
        <span className="text-xs text-muted-foreground animate-pulse">查询中…</span>
      );
    }
    if (s.error) {
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-destructive font-medium">查询失败</span>
          <span className="text-[10px] text-destructive/70 max-w-[120px] break-words leading-tight">
            {s.error}
          </span>
          <button
            onClick={() => fetchDailyChart(code)}
            className="text-[10px] text-primary underline-offset-2 hover:underline text-left mt-0.5"
          >
            重试
          </button>
        </div>
      );
    }
    if (!s.series || s.series.length === 0) {
      return <span className="text-xs text-muted-foreground">-</span>;
    }
    const chartData = s.series.map((p) => ({ ...p, label: p.date.slice(5) }));
    return (
      <div className="flex flex-col gap-0.5 min-w-[200px]">
        <div className="h-[56px] w-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="1 1" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9 }}
                tickFormatter={(v) => v}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 9 }}
                width={32}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (typeof v === "number" ? v.toFixed(1) : v)}
              />
              <Tooltip
                contentStyle={{ fontSize: 11 }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
                formatter={(value: number, name: string) => [typeof value === "number" ? value.toFixed(2) : value, name]}
              />
              <Line
                type="monotone"
                dataKey="close"
                stroke="hsl(var(--foreground))"
                strokeWidth={1.5}
                dot={false}
                name="收盘"
              />
              <Line
                type="monotone"
                dataKey="ma5"
                stroke="hsl(var(--primary))"
                strokeWidth={1}
                dot={false}
                name="MA5"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="ma30"
                stroke="hsl(24 90% 50%)"
                strokeWidth={1}
                dot={false}
                name="MA30"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {s.near && (
            <Badge className="text-[10px] px-1.5 py-0 h-5 w-fit bg-primary/20 text-primary border border-primary/40 font-semibold">
              5日/30日接近
            </Badge>
          )}
          {s.typicalNearMa30 && (
            <Badge className="text-[10px] px-1.5 py-0 h-5 w-fit bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40 font-semibold">
              当日均价≈30日线
            </Badge>
          )}
        </div>
      </div>
    );
  }

  async function handleSectorPatternHover(record: SignalRecord) {
    if (!record.sector || record.sector.length === 0) {
      setHoverPreview(null);
      return;
    }
    const sectorName = record.sector[0];
    const cacheKey = `${record.date}|${sectorName}`;
    if (sectorShotCache.current.has(cacheKey)) {
      const cached = sectorShotCache.current.get(cacheKey);
      if (cached?.imageDataUrl) {
        setHoverPreview({
          url: cached.imageDataUrl,
          title: `${record.date} ${sectorName}`,
        });
      } else {
        setHoverPreview(null);
      }
      return;
    }
    try {
      const shot = await getSectorScreenshot(record.date, sectorName);
      sectorShotCache.current.set(cacheKey, shot);
      if (shot?.imageDataUrl) {
        setHoverPreview({
          url: shot.imageDataUrl,
          title: `${record.date} ${sectorName}`,
        });
      } else {
        setHoverPreview(null);
      }
    } catch {
      setHoverPreview(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-foreground">
            个股列表
            <span className="text-sm font-normal text-muted-foreground ml-2">
              显示 {visibleRecords.length} / {filtered.length} 条（总 {records.length} 条）
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Input
              placeholder="搜索代码、名称、板块..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 bg-secondary text-foreground border-border text-sm"
            />
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-40 bg-secondary text-foreground border-border text-sm">
                <SelectValue placeholder="板块筛选" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="all" className="text-sm focus:bg-secondary focus:text-foreground">
                  全部板块
                </SelectItem>
                {allSectors.map((s) => (
                  <SelectItem
                    key={s}
                    value={s}
                    className="text-sm focus:bg-secondary focus:text-foreground"
                  >
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sortKey}
              onValueChange={(v) => {
                setSortKey(v as SortKey);
                setSortDir(
                  v === "limitUpDays" || v === "maProximity" || v === "ma20Proximity" ? "asc" : "desc"
                );
              }}
            >
              <SelectTrigger className="w-36 bg-secondary text-foreground border-border text-sm">
                <SelectValue placeholder="排序" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="date" className="text-sm focus:bg-secondary focus:text-foreground">录入日</SelectItem>
                <SelectItem value="code" className="text-sm focus:bg-secondary focus:text-foreground">代码</SelectItem>
                <SelectItem value="name" className="text-sm focus:bg-secondary focus:text-foreground">名称</SelectItem>
                <SelectItem value="amount" className="text-sm focus:bg-secondary focus:text-foreground">市值</SelectItem>
                <SelectItem value="debt_ratio" className="text-sm focus:bg-secondary focus:text-foreground">负债率</SelectItem>
                <SelectItem value="tradingDays" className="text-sm focus:bg-secondary focus:text-foreground">交易天数</SelectItem>
                <SelectItem value="limitUpDays" className="text-sm focus:bg-secondary focus:text-foreground">涨停天数</SelectItem>
                <SelectItem value="maProximity" className="text-sm focus:bg-secondary focus:text-foreground">5日/30日接近</SelectItem>
                <SelectItem value="ma20Proximity" className="text-sm focus:bg-secondary focus:text-foreground">20日线接近</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pageSize} onValueChange={(v) => setPageSize(v as "10" | "20" | "50" | "all")}>
              <SelectTrigger className="w-32 bg-secondary text-foreground border-border text-sm">
                <SelectValue placeholder="显示数量" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="10" className="text-sm focus:bg-secondary focus:text-foreground">
                  显示 10 条
                </SelectItem>
                <SelectItem value="20" className="text-sm focus:bg-secondary focus:text-foreground">
                  显示 20 条
                </SelectItem>
                <SelectItem value="50" className="text-sm focus:bg-secondary focus:text-foreground">
                  显示 50 条
                </SelectItem>
                <SelectItem value="all" className="text-sm focus:bg-secondary focus:text-foreground">
                  显示全部
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent sticky top-0 z-20 bg-card">
                  <TableHead className="text-muted-foreground w-8">#</TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                    onClick={() => handleSort("date")}
                  >
                    录入日<SortIcon col="date" />
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                    onClick={() => handleSort("code")}
                  >
                    代码<SortIcon col="code" />
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                    onClick={() => handleSort("name")}
                  >
                    名称<SortIcon col="name" />
                  </TableHead>
                  <TableHead className="text-muted-foreground whitespace-nowrap min-w-[140px]">
                    板块
                  </TableHead>
                  <TableHead className="text-muted-foreground text-center whitespace-nowrap min-w-[100px]">
                    板块分时
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground text-right cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                    onClick={() => handleSort("amount")}
                  >
                    市值(亿)<SortIcon col="amount" />
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground text-right cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                    onClick={() => handleSort("debt_ratio")}
                  >
                    负债率<SortIcon col="debt_ratio" />
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground text-center"
                    onClick={() => handleSort("tradingDays")}
                  >
                    交易天数<SortIcon col="tradingDays" />
                  </TableHead>
                  <TableHead className="text-muted-foreground whitespace-nowrap min-w-[140px]">
                    涨停情况
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort("maProximity")}
                  >
                    5日/30日线
                    {latestMa5Ma30DataDate && (
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground/70">
                        ({latestMa5Ma30DataDate})
                      </span>
                    )}
                    <SortIcon col="maProximity" />
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort("ma20Proximity")}
                  >
                    20日均线
                    {latestMa20DataDate && (
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground/70">
                        (数据日期&nbsp;{latestMa20DataDate})
                      </span>
                    )}
                    <SortIcon col="ma20Proximity" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="text-center text-muted-foreground py-12"
                    >
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRecords.map((r, i) => {
                    const days = calcTradingDays(r.date);
                    return (
                      <TableRow
                        key={`${r.code}-${r.date}-${i}`}
                        className="border-border hover:bg-secondary/50"
                      >
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {i + 1}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {r.date}
                        </TableCell>
                        <TableCell className="font-mono text-sm whitespace-nowrap">
                          <a
                            href={eastmoneyQuoteUrl(r.code)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-medium"
                          >
                            {r.code}
                          </a>
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          <a
                            href={eastmoneyQuoteUrl(r.code)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {r.name}
                          </a>
                        </TableCell>
                        <TableCell className="align-middle min-w-[140px]">
                          <div className="flex flex-wrap gap-2 items-center">
                            {r.sector.map((s) => (
                              <span
                                key={s}
                                className="inline-flex items-center rounded-md bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary border border-primary/25 whitespace-nowrap"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center align-middle min-w-[100px]">
                          {r.sector_pattern ? (
                            <span
                              className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap border ${
                                r.sector_pattern === "水下拉水上"
                                  ? "border-stock-up/50 text-stock-up bg-stock-up/10"
                                  : "border-primary/50 text-primary bg-primary/10"
                              }`}
                              onMouseEnter={() => handleSectorPatternHover(r)}
                              onMouseLeave={() => setHoverPreview(null)}
                            >
                              {r.sector_pattern}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm whitespace-nowrap">
                          {r.amount != null ? r.amount : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm whitespace-nowrap">
                          {r.debt_ratio != null ? `${r.debt_ratio}%` : "-"}
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm whitespace-nowrap">
                          {days === null ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            <span
                              className={
                                days <= 3
                                  ? "text-stock-up font-bold"
                                  : days <= 10
                                    ? "text-primary font-semibold"
                                    : "text-foreground"
                              }
                            >
                              {days}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <LimitUpCell code={r.code} recordDate={r.date} />
                        </TableCell>
                        <TableCell>
                          <Ma5Ma30Cell code={r.code} />
                        </TableCell>
                        <TableCell>
                          <Ma20Cell code={r.code} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* 分页器 */}
          {pageSize !== "all" && filtered.length > Number(pageSize) && (
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <div>
                第{" "}
                <span className="font-mono text-foreground">
                  {pageIndex + 1}
                </span>
                {" / "}
                <span className="font-mono text-foreground">
                  {Math.ceil(filtered.length / Number(pageSize))}
                </span>{" "}
                页
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 px-0 text-xs"
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                >
                  ‹
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 px-0 text-xs"
                  disabled={pageSize === "all" || pageIndex >= Math.ceil(filtered.length / Number(pageSize)) - 1}
                  onClick={() =>
                    setPageIndex((p) =>
                      pageSize === "all"
                        ? 0
                        : Math.min(
                            Math.ceil(filtered.length / Number(pageSize)) - 1,
                            p + 1
                          )
                    )
                  }
                >
                  ›
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {hoverPreview && (
        <div className="fixed bottom-4 right-4 z-40 rounded-md border border-border bg-background/95 shadow-xl px-3 py-2 max-w-[420px] max-h-[260px]">
          <div className="text-[11px] text-muted-foreground mb-1 truncate">
            {hoverPreview.title}
          </div>
          <div className="max-h-[220px] overflow-hidden">
            <img
              src={hoverPreview.url}
              alt={hoverPreview.title}
              className="w-full h-auto object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
