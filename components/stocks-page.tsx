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
import type { SignalRecord } from "@/lib/types";

interface StocksPageProps {
  records: SignalRecord[];
}

type SortKey =
  | "date"
  | "code"
  | "name"
  | "amount"
  | "debt_ratio"
  | "peTTM"
  | "holderNum"
  | "daysSinceLimitUp"
  | "maProximity"
  | "highProximity"
  | "weeklyVolumePattern";

interface DailyChartPoint {
  date: string;
  close: number;
  ma5: number | null;
  ma30: number | null;
  vol5: number | null;  // 5日成交量均线
  vol10: number | null; // 10日成交量均线
}

interface Ma5Ma30Status {
  series: DailyChartPoint[];
  near: boolean | null;
  typicalNearMa30: boolean | null; // 当日分时均价（O/H/L/C 均价）与 30 日线是否接近
  volNear: boolean | null; // 5日成交量与10日成交量是否接近
  latestTradeDate: string | null;
  lastCrossDate: string | null; // 上次 MA5 与 MA30 交叉的日期
  loading: boolean;
  error?: string;
}

interface LimitUpInfo {
  lastLimitUpDate: string | null;  // 上个涨停日
  loading: boolean;
  error?: string;
}

interface WeeklyVolumePatternInfo {
  hasPattern: boolean;
  patternStrength: number;
  description: string;
  weekCount: number;
  weeklyVolumes: number[];
  weekMinus1Volume: number;  // 前1周（最近的完整周）
  weekMinus2Volume: number;  // 前2周
  weekMinus3Volume: number;  // 前3周
  weekMinus4Volume: number;  // 前4周（最早的完整周）
  loading: boolean;
  error?: string;
}

interface HighPointInfo {
  price: number;
  date: string;
  proximityPercent: number;
  aboveOrBelow: "above" | "below" | "equal";
}

interface HighProximityInfo {
  highPoints: HighPointInfo[];      // 多个前高点（按价格降序）
  nearestHighIndex: number;         // 距离目标价最近的高点索引
  latestClose: number | null;
  latestTradeDate: string | null;
  targetPrice: number | null;
  loading: boolean;
  error?: string;
}

/** 雪球个股页 URL：沪 SH、深/京 SZ */
function xueqiuQuoteUrl(code: string): string {
  const c = String(code).replace(/\D/g, "").padStart(6, "0");
  const market = c.startsWith("6") || c.startsWith("5") ? "SH" : "SZ";
  return `https://xueqiu.com/S/${market}${c}`;
}

export function StocksPage({ records }: StocksPageProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [conceptFilter, setConceptFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<"all" | "7" | "14" | "30" | "60">("14");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pageSize, setPageSize] = useState<"10" | "20" | "50" | "all">("10");
  const [pageIndex, setPageIndex] = useState(0);

  // 搜索防抖：用户停止输入 500ms 后才触发搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // 交易日历：存储所有已知交易日（YYYY-MM-DD），用于计算距上个涨停日天数
  const [tradingDays, setTradingDays] = useState<string[]>([]);

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

  // 涨停信息（用于计算距上个涨停日天数）：key = code
  const [limitUpMap, setLimitUpMap] = useState<Record<string, LimitUpInfo>>({});

  // 股票信息（含 PE(TTM)、股东人数）：key = code
  const [stockInfoMap, setStockInfoMap] = useState<Record<string, { peTTM: number | null; holderNum: number | null; loading: boolean; error?: string }>>({});

  // 前高点接近度信息：key = code
  const [highProximityMap, setHighProximityMap] = useState<Record<string, HighProximityInfo>>({});
  const [latestHighProximityDataDate, setLatestHighProximityDataDate] = useState<string | null>(null);

  // 周线放量形态：key = code
  const [weeklyVolumePatternMap, setWeeklyVolumePatternMap] = useState<Record<string, WeeklyVolumePatternInfo>>({});

  const fetchDailyChart = useCallback(async (code: string) => {
    // 先设置 loading 状态，保留已有数据
    setMa5ma30Map((prev) => {
      const p = prev[code];
      // 如果已经在 loading，不重复设置
      if (p?.loading) return prev;
      return {
        ...prev,
        [code]: {
          series: p?.series ?? [],
          latestTradeDate: p?.latestTradeDate ?? null,
          near: p?.near ?? null,
          typicalNearMa30: p?.typicalNearMa30 ?? null,
          volNear: p?.volNear ?? null,
          lastCrossDate: p?.lastCrossDate ?? null,
          loading: true,
          error: undefined,
        },
      };
    });
    try {
      const res = await fetch(`/api/tushare/daily-chart?code=${code}`);
      const data = await res.json();
      if (!res.ok) {
        setMa5ma30Map((prev) => {
          const p = prev[code];
          return {
            ...prev,
            [code]: {
              series: p?.series ?? [],
              latestTradeDate: p?.latestTradeDate ?? null,
              near: p?.near ?? null,
              typicalNearMa30: p?.typicalNearMa30 ?? null,
              volNear: p?.volNear ?? null,
              lastCrossDate: p?.lastCrossDate ?? null,
              loading: false,
              error: data.error || "获取失败",
            },
          };
        });
        return;
      }
      const latestDate =
        data.series?.length > 0
          ? data.series[data.series.length - 1].date
          : null;
      // 只在数据真正变化时才更新
      setMa5ma30Map((prev) => {
        const p = prev[code];
        const newData = {
          series: data.series ?? [],
          near: data.near ?? false,
          typicalNearMa30: data.typicalNearMa30 ?? false,
          volNear: data.volNear ?? false,
          latestTradeDate: latestDate,
          lastCrossDate: data.lastCrossDate ?? null,
          loading: false,
        };
        // 比较新旧数据，如果相同则不更新
        if (
          p &&
          !p.loading &&
          p.series?.length === newData.series.length &&
          p.near === newData.near &&
          p.typicalNearMa30 === newData.typicalNearMa30 &&
          p.volNear === newData.volNear &&
          p.lastCrossDate === newData.lastCrossDate
        ) {
          // 数据相同，不触发重绘
          return prev;
        }
        return {
          ...prev,
          [code]: newData,
        };
      });
      if (latestDate) {
        setLatestMa5Ma30DataDate((d) =>
          !d || latestDate > d ? latestDate : d
        );
      }
    } catch (e: any) {
      setMa5ma30Map((prev) => {
        const p = prev[code];
        return {
          ...prev,
          [code]: {
            series: p?.series ?? [],
            latestTradeDate: p?.latestTradeDate ?? null,
            near: p?.near ?? null,
            typicalNearMa30: p?.typicalNearMa30 ?? null,
            volNear: p?.volNear ?? null,
            lastCrossDate: p?.lastCrossDate ?? null,
            loading: false,
            error: e?.message || "网络请求失败",
          },
        };
      });
    }
  }, []);

  const fetchLimitUp = useCallback(
    async (code: string) => {
      setLimitUpMap((prev) => {
        const p = prev[code];
        return {
          ...prev,
          [code]: {
            lastLimitUpDate: p?.lastLimitUpDate ?? null,
            loading: true,
            error: undefined,
          },
        };
      });
      try {
        const res = await fetch(`/api/tushare/limit-up?code=${code}`);
        const data = await res.json();
        if (!res.ok) {
          setLimitUpMap((prev) => {
            const p = prev[code];
            return {
              ...prev,
              [code]: {
                lastLimitUpDate: p?.lastLimitUpDate ?? null,
                loading: false,
                error: data.error || "获取失败",
              },
            };
          });
          return;
        }
        setLimitUpMap((prev) => ({
          ...prev,
          [code]: {
            lastLimitUpDate: data.lastLimitUpDate ?? null,
            loading: false,
          },
        }));
      } catch (e: any) {
        setLimitUpMap((prev) => {
          const p = prev[code];
          return {
            ...prev,
            [code]: {
              lastLimitUpDate: p?.lastLimitUpDate ?? null,
              loading: false,
              error: e?.message || "网络请求失败",
            },
          };
        });
      }
    },
    []
  );

  const fetchStockInfo = useCallback(async (code: string, tradeDate?: string) => {
    setStockInfoMap((prev) => ({
      ...prev,
      [code]: {
        peTTM: prev[code]?.peTTM ?? null,
        holderNum: prev[code]?.holderNum ?? null,
        loading: true,
        error: undefined,
      },
    }));
    try {
      const url = tradeDate
        ? `/api/tushare/stock-info?code=${code}&tradeDate=${tradeDate}`
        : `/api/tushare/stock-info?code=${code}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setStockInfoMap((prev) => ({
          ...prev,
          [code]: {
            peTTM: prev[code]?.peTTM ?? null,
            holderNum: prev[code]?.holderNum ?? null,
            loading: false,
            error: data.error || "获取失败",
          },
        }));
        return;
      }
      setStockInfoMap((prev) => ({
        ...prev,
        [code]: {
          peTTM: data.peTTM ?? null,
          holderNum: data.holderNum ?? null,
          loading: false,
        },
      }));
    } catch (e: any) {
      setStockInfoMap((prev) => ({
        ...prev,
        [code]: {
          peTTM: prev[code]?.peTTM ?? null,
          holderNum: prev[code]?.holderNum ?? null,
          loading: false,
          error: e?.message || "网络请求失败",
        },
      }));
    }
  }, []);

  const fetchWeeklyVolumePattern = useCallback(async (code: string) => {
    setWeeklyVolumePatternMap((prev) => ({
      ...prev,
      [code]: {
        hasPattern: false,
        patternStrength: 0,
        description: "",
        weekCount: 0,
        weeklyVolumes: [],
        weekMinus1Volume: 0,
        weekMinus2Volume: 0,
        weekMinus3Volume: 0,
        weekMinus4Volume: 0,
        loading: true,
        error: undefined,
      },
    }));
    try {
      const res = await fetch(`/api/tushare/weekly-volume?code=${code}`);
      const data = await res.json();
      if (!res.ok) {
        setWeeklyVolumePatternMap((prev) => ({
          ...prev,
          [code]: {
            hasPattern: false,
            patternStrength: 0,
            description: "",
            weekCount: 0,
            weeklyVolumes: [],
            weekMinus1Volume: 0,
            weekMinus2Volume: 0,
            weekMinus3Volume: 0,
            weekMinus4Volume: 0,
            loading: false,
            error: data.error || "获取失败",
          },
        }));
        return;
      }
      setWeeklyVolumePatternMap((prev) => ({
        ...prev,
        [code]: {
          hasPattern: data.hasPattern ?? false,
          patternStrength: data.patternStrength ?? 0,
          description: data.description ?? "",
          weekCount: data.weekCount ?? 0,
          weeklyVolumes: data.weeklyVolumes ?? [],
          weekMinus1Volume: data.weekMinus1Volume ?? 0,
          weekMinus2Volume: data.weekMinus2Volume ?? 0,
          weekMinus3Volume: data.weekMinus3Volume ?? 0,
          weekMinus4Volume: data.weekMinus4Volume ?? 0,
          loading: false,
        },
      }));
    } catch (e: any) {
      setWeeklyVolumePatternMap((prev) => ({
        ...prev,
        [code]: {
          hasPattern: false,
          patternStrength: 0,
          description: "",
          weekCount: 0,
          weeklyVolumes: [],
          weekMinus1Volume: 0,
          weekMinus2Volume: 0,
          weekMinus3Volume: 0,
          weekMinus4Volume: 0,
          loading: false,
          error: e?.message || "网络请求失败",
        },
      }));
    }
  }, []);

  const fetchHighProximity = useCallback(async (code: string) => {
    setHighProximityMap((prev) => ({
      ...prev,
      [code]: {
        highPoints: prev[code]?.highPoints ?? [],
        nearestHighIndex: prev[code]?.nearestHighIndex ?? -1,
        latestClose: prev[code]?.latestClose ?? null,
        latestTradeDate: prev[code]?.latestTradeDate ?? null,
        targetPrice: prev[code]?.targetPrice ?? null,
        loading: true,
        error: undefined,
      },
    }));
    try {
      const res = await fetch(`/api/tushare/high-proximity?code=${code}`);
      const data = await res.json();
      if (!res.ok) {
        setHighProximityMap((prev) => ({
          ...prev,
          [code]: {
            highPoints: prev[code]?.highPoints ?? [],
            nearestHighIndex: prev[code]?.nearestHighIndex ?? -1,
            latestClose: prev[code]?.latestClose ?? null,
            latestTradeDate: prev[code]?.latestTradeDate ?? null,
            targetPrice: prev[code]?.targetPrice ?? null,
            loading: false,
            error: data.error || "获取失败",
          },
        }));
        return;
      }
      setHighProximityMap((prev) => ({
        ...prev,
        [code]: {
          highPoints: data.highPoints ?? [],
          nearestHighIndex: data.nearestHighIndex ?? -1,
          latestClose: data.latestClose,
          latestTradeDate: data.latestTradeDate,
          targetPrice: data.targetPrice,
          loading: false,
        },
      }));
      if (data.latestTradeDate) {
        setLatestHighProximityDataDate((d) =>
          !d || data.latestTradeDate > d ? data.latestTradeDate : d
        );
      }
    } catch (e: any) {
      setHighProximityMap((prev) => ({
        ...prev,
        [code]: {
          highPoints: prev[code]?.highPoints ?? [],
          nearestHighIndex: prev[code]?.nearestHighIndex ?? -1,
          latestClose: prev[code]?.latestClose ?? null,
          latestTradeDate: prev[code]?.latestTradeDate ?? null,
          targetPrice: prev[code]?.targetPrice ?? null,
          loading: false,
          error: e?.message || "网络请求失败",
        },
      }));
    }
  }, []);

  const allSectors = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      for (const s of r.sector) set.add(s);
    }
    return Array.from(set).sort();
  }, [records]);

  const allConcepts = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      for (const c of r.concept ?? []) set.add(c);
    }
    return Array.from(set).sort();
  }, [records]);

  // 按股票代码去重：同一只股票保留最新录入日的一条记录
  const dedupedRecords = useMemo(() => {
    const latest = new Map<string, SignalRecord>();
    for (const r of records) {
      const existing = latest.get(r.code);
      if (!existing || r.date > existing.date) {
        latest.set(r.code, r);
      }
    }
    return Array.from(latest.values());
  }, [records]);

  const filtered = useMemo(() => {
    let list = [...dedupedRecords];

    // 时间范围筛选：只显示最近 N 天内录入的股票
    if (dateRangeFilter !== "all") {
      const days = parseInt(dateRangeFilter, 10);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffStr = cutoffDate.toISOString().slice(0, 10);
      list = list.filter((r) => r.date >= cutoffStr);
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.code.includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.sector.some((s) => s.toLowerCase().includes(q)) ||
          (r.concept ?? []).some((c) => c.toLowerCase().includes(q))
      );
    }

    if (sectorFilter !== "all") {
      list = list.filter((r) => r.sector.includes(sectorFilter));
    }
    if (conceptFilter !== "all") {
      list = list.filter((r) => (r.concept ?? []).includes(conceptFilter));
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
        case "peTTM": {
          const getPE = (r: SignalRecord): number | null => {
            const s = stockInfoMap[r.code];
            if (!s || s.peTTM == null) return null;
            return s.peTTM;
          };
          av = getPE(a);
          bv = getPE(b);
          break;
        }
        case "holderNum": {
          const getHolderNum = (r: SignalRecord): number | null => {
            const s = stockInfoMap[r.code];
            if (!s || s.holderNum == null) return null;
            return s.holderNum;
          };
          av = getHolderNum(a);
          bv = getHolderNum(b);
          break;
        }
        case "daysSinceLimitUp": {
          const getDays = (r: SignalRecord): number | null => {
            const info = limitUpMap[r.code];
            if (!info || info.loading || !info.lastLimitUpDate) return null;
            // 计算距上个涨停日的交易日天数
            const today = new Date().toISOString().slice(0, 10);
            const lastLimitUp = info.lastLimitUpDate;
            if (tradingDays.length === 0) return null;
            return tradingDays.filter((d) => d > lastLimitUp && d <= today).length;
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
        case "highProximity": {
          const getProximity = (r: SignalRecord): number | null => {
            const s = highProximityMap[r.code];
            if (!s || !s.highPoints || s.highPoints.length === 0) return null;
            // 使用最近的前高点距离
            const nearest = s.nearestHighIndex >= 0 ? s.highPoints[s.nearestHighIndex] : s.highPoints[0];
            return nearest.proximityPercent;
          };
          av = getProximity(a);
          bv = getProximity(b);
          break;
        }
        case "weeklyVolumePattern": {
          // 按形态强度排序，强度越高排越前
          const getPatternStrength = (r: SignalRecord): number => {
            const s = weeklyVolumePatternMap[r.code];
            if (!s || s.loading || s.error) return -1;
            return s.hasPattern ? s.patternStrength : -1;
          };
          av = getPatternStrength(a);
          bv = getPatternStrength(b);
          // 降序排序：强度高的排前面
          if (sortDir === "asc") {
            [av, bv] = [bv, av];
          }
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
    dedupedRecords,
    debouncedSearch,
    sectorFilter,
    conceptFilter,
    dateRangeFilter,
    sortKey,
    sortDir,
    limitUpMap,
    stockInfoMap,
    tradingDays,
    ma5ma30Map,
    highProximityMap,
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
  }, [debouncedSearch, sectorFilter, conceptFilter, dateRangeFilter, sortKey, sortDir, pageSize]);

  useEffect(() => {
    if (pageSize === "all") return;
    const limit = Number(pageSize);
    const totalPages = Math.max(1, Math.ceil(filtered.length / (limit || 1)));
    setPageIndex((prev) => Math.min(prev, totalPages - 1));
  }, [filtered.length, pageSize]);

  // 自动查询：
  // - 对当前展示记录触发 MA5-MA30
  // - 当排序依据是“涨停天数”或“MA 接近程度”时，对过滤后的全集触发对应查询，保证排序基于全集数据
  // ========== 请求队列：失败时暂停重试 ==========
  // Tushare API 限制：一分钟500次 = 约8次/秒，正常请求不会超限
  // 添加请求间隔确保不会触发限流
  const requestQueueRef = useRef<{
    queue: Array<() => Promise<void>>;
    processing: boolean;
    paused: boolean;
    pauseUntil: number;
  }>({
    queue: [],
    processing: false,
    paused: false,
    pauseUntil: 0,
  });

  // 进度追踪
  const [queueTotal, setQueueTotal] = useState(0);
  const [queueCompleted, setQueueCompleted] = useState(0);
  const [queuePaused, setQueuePaused] = useState(false);

  const REQUEST_INTERVAL = 250; // 每个请求间隔250ms（确保不超过500次/分钟）
  const PAUSE_DURATION = 10000; // 失败时暂停10秒
  const MAX_RETRIES = 5; // 最大重试次数
  const RETRY_DELAYS = [5000, 10000, 20000, 30000, 60000]; // 重试延迟：5s, 10s, 20s, 30s, 60s

  const processQueue = useCallback(async () => {
    if (requestQueueRef.current.processing) return;
    requestQueueRef.current.processing = true;

    while (requestQueueRef.current.queue.length > 0) {
      // 检查是否需要暂停
      const now = Date.now();
      if (requestQueueRef.current.paused && now < requestQueueRef.current.pauseUntil) {
        const waitTime = requestQueueRef.current.pauseUntil - now;
        console.log(`API 限流，暂停 ${waitTime}ms...`);
        setQueuePaused(true);
        await new Promise((r) => setTimeout(r, waitTime));
        requestQueueRef.current.paused = false;
        setQueuePaused(false);
      }

      const task = requestQueueRef.current.queue.shift();
      if (task) {
        try {
          await task();
          setQueueCompleted((c) => c + 1);
        } catch (e) {
          console.error("队列任务执行失败:", e);
        }
        // 每个请求后等待间隔
        await new Promise((r) => setTimeout(r, REQUEST_INTERVAL));
      }
    }

    requestQueueRef.current.processing = false;
  }, []);

  const enqueueRequest = useCallback(
    (fn: () => Promise<void>, retries = 0): void => {
      setQueueTotal((t) => t + 1);
      const wrappedTask = async () => {
        try {
          await fn();
        } catch (e: any) {
          // 检测是否是频率限制错误
          const isRateLimited =
            e?.message?.includes("过快") ||
            e?.message?.includes("频率") ||
            e?.message?.includes("limit") ||
            e?.message?.includes("rate");

          if (isRateLimited) {
            // 触发全局暂停
            requestQueueRef.current.paused = true;
            requestQueueRef.current.pauseUntil = Date.now() + PAUSE_DURATION;
            console.log(`API 频率限制，全局暂停 ${PAUSE_DURATION}ms`);
            setQueuePaused(true);
          }

          if (retries < MAX_RETRIES) {
            const delay = RETRY_DELAYS[retries];
            console.log(`请求失败，${delay}ms后重试 (${retries + 1}/${MAX_RETRIES})`);
            await new Promise((r) => setTimeout(r, delay));
            requestQueueRef.current.queue.push(() => fn());
            void processQueue();
          } else {
            console.error("请求最终失败:", e?.message);
            setQueueCompleted((c) => c + 1); // 失败也计入完成
          }
        }
      };
      requestQueueRef.current.queue.push(wrappedTask);
      void processQueue();
    },
    [processQueue]
  );

  const fetchedMa5Ma30Ref = useRef<Set<string>>(new Set());
  const fetchedLimitUpRef = useRef<Set<string>>(new Set());
  const fetchedHighProximityRef = useRef<Set<string>>(new Set());
  const fetchedWeeklyVolumeRef = useRef<Set<string>>(new Set());

  // 当筛选条件变化时，清除已获取缓存，避免重复获取不在当前筛选结果中的股票
  useEffect(() => {
    fetchedMa5Ma30Ref.current.clear();
    fetchedLimitUpRef.current.clear();
    fetchedHighProximityRef.current.clear();
    fetchedWeeklyVolumeRef.current.clear();
  }, [debouncedSearch, sectorFilter, conceptFilter, dateRangeFilter]);

  useEffect(() => {
    // 5日线/30日线排序需要全量数据才能正确排序
    const needFullData = sortKey === "maProximity";
    const needFullWeekly = sortKey === "weeklyVolumePattern";
    const baseCodes = needFullData || needFullWeekly
      ? Array.from(new Set(filtered.map((r) => r.code)))
      : Array.from(new Set(visibleRecords.map((r) => r.code)));

    // MA5MA30: 排序时获取全量，否则只获取可见页（通过队列控制速率）
    for (const code of baseCodes) {
      if (!fetchedMa5Ma30Ref.current.has(code)) {
        fetchedMa5Ma30Ref.current.add(code);
        enqueueRequest(async () => { await fetchDailyChart(code); });
      }
    }

    // 其他数据只获取当前可见页面（通过队列控制速率）
    const visibleCodes = Array.from(new Set(visibleRecords.map((r) => r.code)));
    for (const code of visibleCodes) {
      if (!fetchedHighProximityRef.current.has(code)) {
        fetchedHighProximityRef.current.add(code);
        enqueueRequest(async () => { await fetchHighProximity(code); });
      }
      if (!fetchedLimitUpRef.current.has(code)) {
        fetchedLimitUpRef.current.add(code);
        enqueueRequest(async () => { await fetchLimitUp(code); });
      }
    }

    // 周线放量：排序时获取全量，否则只获取可见页
    const weeklyCodes = needFullWeekly
      ? Array.from(new Set(filtered.map((r) => r.code)))
      : visibleCodes;
    for (const code of weeklyCodes) {
      if (!fetchedWeeklyVolumeRef.current.has(code)) {
        fetchedWeeklyVolumeRef.current.add(code);
        enqueueRequest(async () => { await fetchWeeklyVolumePattern(code); });
      }
    }
  }, [visibleRecords, filtered, sortKey, enqueueRequest]);

  // 监听 highProximityMap 变化，获取到 latestTradeDate 后触发 fetchStockInfo
  const fetchedStockInfoWithDateRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const code of Object.keys(highProximityMap)) {
      const hp = highProximityMap[code];
      if (hp?.latestTradeDate && !hp.loading && !hp.error && !fetchedStockInfoWithDateRef.current.has(code)) {
        fetchedStockInfoWithDateRef.current.add(code);
        // 接入全局队列，控制速率
        enqueueRequest(async () => { await fetchStockInfo(code, hp.latestTradeDate); });
      }
    }
  }, [highProximityMap, enqueueRequest]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // 涨停天数 & MA 接近程度都是“数值越小越好”，默认升序；其它默认降序
      setSortDir(
        key === "limitUpDays" || key === "maProximity" || key === "highProximity"
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

  /** PE(TTM) 显示，含假设价格 PE 计算小功能 */
  function PECell({ code }: { code: string }) {
    const s = stockInfoMap[code];
    if (!s) {
      return <span className="text-xs text-muted-foreground">加载中…</span>;
    }
    if (s.loading) {
      return <span className="text-xs text-muted-foreground animate-pulse">查询中…</span>;
    }
    if (s.error && s.peTTM == null) {
      return (
        <span className="text-[10px] text-destructive" title={s.error}>
          查询失败
        </span>
      );
    }
    if (s.peTTM == null) {
      return <span className="text-xs text-muted-foreground">-</span>;
    }
    // 获取最新收盘价用于 PE 计算小功能
    const hpInfo = highProximityMap[code];
    const latestClose = hpInfo?.latestClose;

    return (
      <div className="flex flex-col gap-0.5 min-w-[80px]" title="修改假设价格计算PE">
        <span className="font-mono text-xs text-foreground font-semibold">
          {s.peTTM.toFixed(1)}
        </span>
        {latestClose != null && latestClose > 0 && (
          <input
            type="number"
            defaultValue={latestClose.toFixed(2)}
            className="text-[10px] font-mono bg-secondary border border-border rounded px-1 py-0.5 w-full text-foreground"
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0 && s.peTTM != null) {
                const ratio = v / latestClose;
                const newPE = s.peTTM * ratio;
                e.target.title = `假设价格 ${v.toFixed(2)} → PE ${newPE.toFixed(1)}`;
              } else {
                e.target.title = "";
              }
            }}
          />
        )}
      </div>
    );
  }

  /** 股东人数 */
  function HolderNumCell({ code }: { code: string }) {
    const s = stockInfoMap[code];
    if (!s) {
      return <span className="text-xs text-muted-foreground">加载中…</span>;
    }
    if (s.loading) {
      return <span className="text-xs text-muted-foreground animate-pulse">查询中…</span>;
    }
    if (s.error && s.holderNum == null) {
      return (
        <span className="text-[10px] text-destructive" title={s.error}>
          查询失败
        </span>
      );
    }
    if (s.holderNum == null) {
      return <span className="text-xs text-muted-foreground">-</span>;
    }
    // 格式化股东人数：万为单位
    const holderWan = s.holderNum / 10000;
    return (
      <span className="font-mono text-xs text-foreground">
        {holderWan >= 1 ? holderWan.toFixed(2) + "万" : s.holderNum.toLocaleString()}
      </span>
    );
  }

  /** 距上个涨停日的交易日天数 */
  function DaysSinceLimitUpCell({ code }: { code: string }) {
    const info = limitUpMap[code];
    if (!info) {
      return <span className="text-xs text-muted-foreground">加载中…</span>;
    }
    if (info.loading) {
      return <span className="text-xs text-muted-foreground animate-pulse">查询中…</span>;
    }
    if (info.error && !info.lastLimitUpDate) {
      return (
        <span className="text-[10px] text-destructive" title={info.error}>
          查询失败
        </span>
      );
    }
    if (!info.lastLimitUpDate) {
      return <span className="text-xs text-muted-foreground">暂无涨停</span>;
    }
    const today = new Date().toISOString().slice(0, 10);
    const days = tradingDays.length > 0
      ? tradingDays.filter((d) => d > info.lastLimitUpDate! && d <= today).length
      : null;
    return (
      <div className="flex flex-col gap-0.5">
        <span className={
          days != null && days <= 3
            ? "font-mono text-xs text-stock-up font-bold"
            : days != null && days <= 10
              ? "font-mono text-xs text-primary font-semibold"
              : "font-mono text-xs text-foreground"
        }>
          {days !== null ? `${days}日` : "-"}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {info.lastLimitUpDate}
        </span>
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
    const dailyStale = !!s.error && s.series && s.series.length > 0;
    if (s.error && !dailyStale) {
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
        {dailyStale && (
          <div className="text-[10px] text-amber-700 dark:text-amber-400 max-w-[200px] leading-tight">
            刷新失败，以下为上次数据：
            <span className="block text-destructive/90 mt-0.5">{s.error}</span>
            <button
              type="button"
              onClick={() => fetchDailyChart(code)}
              className="text-primary underline-offset-2 hover:underline mt-0.5"
            >
              重试
            </button>
          </div>
        )}
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
          {s.volNear && (
            <Badge className="text-[10px] px-1.5 py-0 h-5 w-fit bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40 font-semibold">
              5日/10日量接近
            </Badge>
          )}
          {s.lastCrossDate && (
            <span className="text-[10px] text-muted-foreground">
              上次交叉: {s.lastCrossDate}
              {tradingDays.length > 0 && (() => {
                const today = new Date().toISOString().slice(0, 10);
                const days = tradingDays.filter((d) => d > s.lastCrossDate! && d <= today).length;
                return ` (${days}日前)`;
              })()}
            </span>
          )}
        </div>
      </div>
    );
  }

  function HighProximityCell({ code }: { code: string }) {
    const s = highProximityMap[code];
    if (!s) {
      return <span className="text-xs text-muted-foreground">加载中…</span>;
    }
    if (s.loading) {
      return <span className="text-xs text-muted-foreground animate-pulse">查询中…</span>;
    }
    if (s.error && (!s.highPoints || s.highPoints.length === 0)) {
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-destructive font-medium">查询失败</span>
          <span className="text-[10px] text-destructive/70 max-w-[120px] break-words leading-tight">
            {s.error}
          </span>
          <button
            onClick={() => fetchHighProximity(code)}
            className="text-[10px] text-primary underline-offset-2 hover:underline text-left mt-0.5"
          >
            重试
          </button>
        </div>
      );
    }
    if (!s.highPoints || s.highPoints.length === 0) {
      return <span className="text-xs text-muted-foreground">-</span>;
    }

    // 获取最近的前高点
    const nearestHigh = s.nearestHighIndex >= 0 ? s.highPoints[s.nearestHighIndex] : s.highPoints[0];
    const isNear = nearestHigh.proximityPercent <= 5;
    const isVeryNear = nearestHigh.proximityPercent <= 2;

    return (
      <div className="flex flex-col gap-0.5 min-w-[120px]">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-foreground font-semibold">
            {nearestHigh.proximityPercent.toFixed(2)}%
          </span>
          {isVeryNear && (
            <Badge className="text-[10px] px-1.5 py-0 h-5 bg-stock-up/20 text-stock-up border border-stock-up/40 font-semibold">
              极近
            </Badge>
          )}
          {isNear && !isVeryNear && (
            <Badge className="text-[10px] px-1.5 py-0 h-5 bg-primary/20 text-primary border border-primary/40 font-semibold">
              接近
            </Badge>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground leading-tight">
          {s.highPoints.map((hp, idx) => (
            <div key={idx} className={idx === s.nearestHighIndex ? "text-foreground font-medium" : ""}>
              第{idx + 1}高: {hp.price.toFixed(2)} ({hp.date}) {hp.proximityPercent.toFixed(1)}%
            </div>
          ))}
          <div>目标: {s.targetPrice?.toFixed(2)} (收盘+10%)</div>
          <div>最新: {s.latestClose?.toFixed(2)}</div>
        </div>
      </div>
    );
  }

  function WeeklyVolumePatternCell({ code }: { code: string }) {
    const s = weeklyVolumePatternMap[code];
    if (!s) {
      return <span className="text-xs text-muted-foreground">加载中…</span>;
    }
    if (s.loading) {
      return <span className="text-xs text-muted-foreground animate-pulse">查询中…</span>;
    }
    if (s.error) {
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-destructive font-medium">查询失败</span>
          <button
            onClick={() => fetchWeeklyVolumePattern(code)}
            className="text-[10px] text-primary underline-offset-2 hover:underline text-left mt-0.5"
          >
            重试
          </button>
        </div>
      );
    }
    // 统一使用 weeklyVolumes 或单独字段渲染柱状图
    const volumes = (s.weeklyVolumes && s.weeklyVolumes.length === 4)
      ? s.weeklyVolumes
      : [s.weekMinus4Volume || 0, s.weekMinus3Volume || 0, s.weekMinus2Volume || 0, s.weekMinus1Volume || 0];
    const hasVolumeData = volumes.some(v => v > 0);

    if (!hasVolumeData) {
      return <span className="text-xs text-muted-foreground">-</span>;
    }

    if (!s.hasPattern) {
      const maxVol = Math.max(...volumes, 1);
      return (
        <div className="flex flex-col gap-0.5 min-w-[100px]">
          <div className="flex gap-1">
            {volumes.map((vol, i) => {
              const height = (vol / maxVol) * 100;
              const barColor = i === 0 || i === 3 ? "bg-primary/60" : "bg-muted-foreground/40";
              return (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <div className="w-3 h-8 bg-secondary rounded-sm relative overflow-hidden">
                    <div
                      className={`absolute bottom-0 left-0 right-0 ${barColor} rounded-sm`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-muted-foreground">W{4 - i}</span>
                </div>
              );
            })}
          </div>
          {s.description && (
            <div className="text-[9px] text-muted-foreground leading-tight">
              {s.description}
            </div>
          )}
        </div>
      );
    }

    // 有形态时显示
    const strengthColor = s.patternStrength >= 80 
      ? "bg-stock-up/20 text-stock-up border-stock-up/40"
      : s.patternStrength >= 60
      ? "bg-primary/20 text-primary border-primary/40"
      : "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40";

    const maxVol = Math.max(...volumes, 1);

    return (
      <div className="flex flex-col gap-0.5 min-w-[100px]">
        <div className="flex items-center gap-1.5">
          <Badge className={`text-[10px] px-1.5 py-0 h-5 w-fit ${strengthColor} font-semibold`}>
            周线放量
          </Badge>
          <span className="text-[10px] text-muted-foreground">{s.patternStrength}%</span>
        </div>
        <div className="flex gap-1">
          {volumes.map((vol, i) => {
            const height = (vol / maxVol) * 100;
            const barColor = i === 0 || i === 3 ? "bg-stock-up/70" : "bg-muted-foreground/30";
            const label = i === 0 ? "左放" : i === 3 ? "右放" : "缩";
            return (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <div className="w-3 h-10 bg-secondary rounded-sm relative overflow-hidden">
                  <div
                    className={`absolute bottom-0 left-0 right-0 ${barColor} rounded-sm transition-all`}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className="text-[7px] text-muted-foreground">{label}</span>
              </div>
            );
          })}
        </div>
        <div className="text-[9px] text-muted-foreground leading-tight">
          {s.description}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-foreground">
            个股列表
            <span className="text-sm font-normal text-muted-foreground ml-2">
              显示 {visibleRecords.length} / {filtered.length} 条（总 {dedupedRecords.length} 只）
            </span>
          </CardTitle>
          {/* 数据加载进度条 */}
          {queueTotal > 0 && queueCompleted < queueTotal && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>
                  {queuePaused ? (
                    <span className="text-orange-500 animate-pulse">API限流，暂停中...</span>
                  ) : (
                    "正在加载数据..."
                  )}
                </span>
                <span>{queueCompleted} / {queueTotal}</span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${queuePaused ? "bg-orange-500" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, (queueCompleted / queueTotal) * 100)}%` }}
                />
              </div>
            </div>
          )}
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
            <Select value={conceptFilter} onValueChange={setConceptFilter}>
              <SelectTrigger className="w-40 bg-secondary text-foreground border-border text-sm">
                <SelectValue placeholder="概念筛选" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="all" className="text-sm focus:bg-secondary focus:text-foreground">
                  全部概念
                </SelectItem>
                {allConcepts.map((c) => (
                  <SelectItem
                    key={c}
                    value={c}
                    className="text-sm focus:bg-secondary focus:text-foreground"
                  >
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateRangeFilter} onValueChange={(v) => setDateRangeFilter(v as "all" | "7" | "14" | "30" | "60")}>
              <SelectTrigger className="w-32 bg-secondary text-foreground border-border text-sm">
                <SelectValue placeholder="时间范围" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="all" className="text-sm focus:bg-secondary focus:text-foreground">
                  全部
                </SelectItem>
                <SelectItem value="7" className="text-sm focus:bg-secondary focus:text-foreground">
                  近7天
                </SelectItem>
                <SelectItem value="14" className="text-sm focus:bg-secondary focus:text-foreground">
                  近14天
                </SelectItem>
                <SelectItem value="30" className="text-sm focus:bg-secondary focus:text-foreground">
                  近30天
                </SelectItem>
                <SelectItem value="60" className="text-sm focus:bg-secondary focus:text-foreground">
                  近60天
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sortKey}
              onValueChange={(v) => {
                setSortKey(v as SortKey);
                setSortDir(
                  v === "peTTM" || v === "daysSinceLimitUp" || v === "maProximity" || v === "highProximity" ? "asc" : "desc"
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
                <SelectItem value="peTTM" className="text-sm focus:bg-secondary focus:text-foreground">PE(TTM)</SelectItem>
                <SelectItem value="holderNum" className="text-sm focus:bg-secondary focus:text-foreground">股东人数</SelectItem>
                <SelectItem value="daysSinceLimitUp" className="text-sm focus:bg-secondary focus:text-foreground">距涨停日</SelectItem>
                <SelectItem value="maProximity" className="text-sm focus:bg-secondary focus:text-foreground">5日/30日接近</SelectItem>
                
                <SelectItem value="highProximity" className="text-sm focus:bg-secondary focus:text-foreground">前高点接近</SelectItem>
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
                  <TableHead className="text-muted-foreground whitespace-nowrap min-w-[160px]">
                    概念
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort("peTTM")}
                  >
                    PE(TTM)
                    <SortIcon col="peTTM" />
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort("holderNum")}
                  >
                    股东人数
                    <SortIcon col="holderNum" />
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort("daysSinceLimitUp")}
                  >
                    距涨停日
                    <SortIcon col="daysSinceLimitUp" />
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
                    onClick={() => handleSort("highProximity")}
                  >
                    前高点接近
                    {latestHighProximityDataDate && (
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground/70">
                        (数据日期&nbsp;{latestHighProximityDataDate})
                      </span>
                    )}
                    <SortIcon col="highProximity" />
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort("weeklyVolumePattern")}
                  >
                    周线放量
                    <SortIcon col="weeklyVolumePattern" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={14}
                      className="text-center text-muted-foreground py-12"
                    >
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRecords.map((r, i) => {
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
                            href={xueqiuQuoteUrl(r.code)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-medium"
                          >
                            {r.code}
                          </a>
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          <a
                            href={xueqiuQuoteUrl(r.code)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {r.name}
                          </a>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {r.amount != null && (
                              <span className="text-[10px] text-red-500 dark:text-red-400 font-mono">
                                {r.amount}亿
                              </span>
                            )}
                          </div>
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
                        <TableCell className="align-middle min-w-[160px]">
                          <div className="flex flex-wrap gap-2 items-center">
                            {(r.concept ?? []).length > 0 ? (
                              (r.concept ?? []).map((c) => (
                                <span
                                  key={c}
                                  className="inline-flex items-center rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 border border-amber-500/25 whitespace-nowrap"
                                >
                                  {c}
                                </span>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <PECell code={r.code} />
                        </TableCell>
                        <TableCell>
                          <HolderNumCell code={r.code} />
                        </TableCell>
                        <TableCell>
                          <DaysSinceLimitUpCell code={r.code} />
                        </TableCell>
                        <TableCell>
                          <Ma5Ma30Cell code={r.code} />
                        </TableCell>
                        
                        <TableCell>
                          <HighProximityCell code={r.code} />
                        </TableCell>
                        <TableCell>
                          <WeeklyVolumePatternCell code={r.code} />
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
    </div>
  );
}
