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
import type { SignalRecord } from "@/lib/types";

interface StocksPageProps {
  records: SignalRecord[];
}

type SortKey =
  | "date"
  | "code"
  | "name"
  | "turnover"
  | "chg"
  | "amount"
  | "debt_ratio"
  | "tradingDays";

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

export function StocksPage({ records }: StocksPageProps) {
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  // 自动查询：records 变化时，对所有去重代码触发 MA20 / MA5-MA30 查询（跳过已有数据的）
  const fetchedRef = useRef<Set<string>>(new Set());
  const fetchedMa5Ma30Ref = useRef<Set<string>>(new Set());
  useEffect(() => {
    const codes = Array.from(new Set(records.map((r) => r.code)));
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
  }, [records, fetchMa20, fetchDailyChart]);

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
        case "turnover":
          av = a.turnover;
          bv = b.turnover;
          break;
        case "chg":
          av = a.chg;
          bv = b.chg;
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
      }
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [records, search, sectorFilter, sortKey, sortDir, calcTradingDays]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
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
        <span className="text-xs text-muted-foreground animate-pulse">
          查询中…
        </span>
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

  function Ma5Ma30Cell({ code }: { code: string }) {
    const s = ma5ma30Map[code];
    if (!s) {
      return <span className="text-xs text-muted-foreground">加载中…</span>;
    }
    if (s.loading) {
      return (
        <span className="text-xs text-muted-foreground animate-pulse">
          查询中…
        </span>
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
    const chartData = s.series.map((p) => ({
      ...p,
      label: p.date.slice(5),
    }));
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

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-foreground">
            个股列表
            <span className="text-sm font-normal text-muted-foreground ml-2">
              共 {filtered.length} / {records.length} 条
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
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
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
                    onClick={() => handleSort("turnover")}
                  >
                    换手率<SortIcon col="turnover" />
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground text-right cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                    onClick={() => handleSort("chg")}
                  >
                    涨跌幅<SortIcon col="chg" />
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
                  <TableHead className="text-muted-foreground whitespace-nowrap">
                    5日/30日线
                    {latestMa5Ma30DataDate && (
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground/70">
                        ({latestMa5Ma30DataDate})
                      </span>
                    )}
                  </TableHead>
                  <TableHead className="text-muted-foreground whitespace-nowrap">
                    20日均线
                    {latestMa20DataDate && (
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground/70">
                        (数据日期&nbsp;{latestMa20DataDate})
                      </span>
                    )}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={13}
                      className="text-center text-muted-foreground py-12"
                    >
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r, i) => {
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
                        <TableCell className="font-mono text-sm text-foreground whitespace-nowrap">
                          {r.code}
                        </TableCell>
                        <TableCell className="font-medium text-foreground whitespace-nowrap">
                          {r.name}
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
                            >
                              {r.sector_pattern}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm whitespace-nowrap">
                          {r.turnover != null ? `${r.turnover}%` : "-"}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono text-sm whitespace-nowrap ${
                            r.chg != null
                              ? r.chg > 0
                                ? "text-stock-down"
                                : r.chg < 0
                                  ? "text-stock-up"
                                  : "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {r.chg != null
                            ? `${r.chg > 0 ? "+" : ""}${r.chg}%`
                            : "-"}
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
        </CardContent>
      </Card>
    </div>
  );
}
