"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ComposedChart,
  Bar,
  Cell,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { DeliveryRecord } from "@/lib/types";
import { Upload, LayoutGrid, List, Search, FolderOpen, Trash2 } from "lucide-react";

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, "").trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, "").trim());
  return result;
}

function parseBrokerageCSV(text: string): Omit<DeliveryRecord, "id">[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const idx = (name: RegExp) => headers.findIndex((h) => name.test(h.replace(/\s/g, "")));
  const dateCol = idx(/业务日期|成交日期|日期/) >= 0 ? idx(/业务日期|成交日期|日期/) : 0;
  const codeCol = idx(/证券代码|代码/) >= 0 ? idx(/证券代码|代码/) : 4;
  const nameCol = idx(/证券名称|名称/) >= 0 ? idx(/证券名称|名称/) : 5;
  const dirCol = idx(/业务标志|操作|买卖|方向/) >= 0 ? idx(/业务标志|操作|买卖|方向/) : 6;
  const qtyCol = idx(/成交数量|数量/) >= 0 ? idx(/成交数量|数量/) : 7;
  const priceCol = idx(/成交价格|价格/) >= 0 ? idx(/成交价格|价格/) : 8;
  const feeColIndices = [
    idx(/净佣金|佣金|手续费/),
    idx(/过户费/),
    idx(/证管费/),
    idx(/经手费/),
    idx(/其他费/),
  ].filter((i) => i >= 0);
  if (feeColIndices.length === 0 && idx(/净佣金/) >= 0) feeColIndices.push(idx(/净佣金/));
  const taxCol = idx(/印花税/) >= 0 ? idx(/印花税/) : 10;
  const settleCol = idx(/清算金额|发生金额|金额/) >= 0 ? idx(/清算金额|发生金额|金额/) : 15;

  const num = (s: string): number => {
    if (s == null || s === "") return 0;
    const n = parseFloat(String(s).replace(/[,\s]/g, ""));
    return isNaN(n) ? 0 : n;
  };

  const normDate = (s: string): string => {
    if (!s) return "";
    const m = s.replace(/\s/g, "").match(/(\d{4})[-\/]?(\d{1,2})[-\/]?(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    return s;
  };

  const normDir = (s: string): "买" | "卖" => {
    if (/买|买入|B|b/.test(s)) return "买";
    return "卖";
  };

  const records: Omit<DeliveryRecord, "id">[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const date = normDate(cells[dateCol] ?? "");
    const code = String(cells[codeCol] ?? "").replace(/\D/g, "").padStart(6, "0").slice(0, 6);
    const name = String(cells[nameCol] ?? "").trim() || "—";
    if (!date || !code) continue;

    const direction = normDir(cells[dirCol] ?? "卖");
    const quantity = Math.abs(Math.round(num(cells[qtyCol] ?? "0")));
    if (quantity === 0) continue;
    const price = num(cells[priceCol] ?? "0");
    const amount = quantity * price;
    const fee = feeColIndices.length > 0
      ? feeColIndices.reduce((sum, col) => sum + num(cells[col] ?? "0"), 0)
      : null;
    const tax = taxCol >= 0 && cells[taxCol] !== undefined ? num(cells[taxCol]) : null;
    const settle = settleCol >= 0 && cells[settleCol] !== undefined ? num(cells[settleCol]) : null;

    records.push({
      date,
      code,
      name,
      direction,
      quantity,
      price,
      amount,
      fee: fee !== 0 ? fee : null,
      tax: tax !== 0 ? tax : null,
      remark: settle != null ? `清算: ${settle.toFixed(2)}` : null,
    });
  }
  return records;
}

interface DeliveryBatch {
  id: number;
  name: string;
  sourceFileName: string | null;
  createdAt: string | null;
  recordCount: number;
  dateRange: { min: string; max: string } | null;
  buyAmount: number;
  sellAmount: number;
}

export function DeliveryPanel() {
  const [batches, setBatches] = useState<DeliveryBatch[]>([]);
  const [list, setList] = useState<DeliveryRecord[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"shelf" | "grid" | "list">("shelf");
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [dirFilter, setDirFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"new" | "old">("new");

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/delivery/batches");
      if (!res.ok) throw new Error("获取批次失败");
      const data = await res.json();
      setBatches(data);
    } catch (e: any) {
      setError(e.message || "加载失败");
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchList = useCallback(async (batchId?: number | null) => {
    setLoading(true);
    setError(null);
    try {
      const url = batchId !== undefined && batchId !== null
        ? `/api/delivery?batchId=${batchId}`
        : "/api/delivery";
      const res = await fetch(url);
      if (!res.ok) throw new Error("获取列表失败");
      const data = await res.json();
      setList(data);
    } catch (e: any) {
      setError(e.message || "加载失败");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  useEffect(() => {
    if (viewMode === "shelf" && selectedBatchId === null) {
      setList([]);
      return;
    }
    fetchList(viewMode === "shelf" ? undefined : selectedBatchId);
  }, [viewMode, selectedBatchId, fetchList]);

  const loadBatchRecords = useCallback((batchId: number) => {
    setSelectedBatchId(batchId);
    setViewMode("list");
    fetchList(batchId);
  }, [fetchList]);

  const loadAllRecords = useCallback(() => {
    setSelectedBatchId(null);
    setViewMode("list");
  }, []);

  const filtered = useMemo(() => {
    let out = [...list];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (r) =>
          r.code.includes(q) || r.name.toLowerCase().includes(q)
      );
    }
    if (yearFilter !== "all") {
      out = out.filter((r) => r.date.startsWith(yearFilter));
    }
    if (monthFilter !== "all") {
      out = out.filter((r) => r.date.slice(5, 7) === monthFilter);
    }
    if (dirFilter !== "all") {
      out = out.filter((r) => r.direction === dirFilter);
    }

    out.sort((a, b) =>
      sortOrder === "new"
        ? b.date.localeCompare(a.date)
        : a.date.localeCompare(b.date)
    );
    return out;
  }, [list, search, yearFilter, monthFilter, dirFilter, sortOrder]);

  const years = useMemo(() => {
    const set = new Set(list.map((r) => r.date.slice(0, 4)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [list]);

  const months = useMemo(() => {
    const set = new Set(list.map((r) => r.date.slice(5, 7)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [list]);

  const stats = useMemo(() => {
    const buy = filtered.filter((r) => r.direction === "买");
    const sell = filtered.filter((r) => r.direction === "卖");
    const buyAmount = buy.reduce((s, r) => s + r.amount, 0);
    const sellAmount = sell.reduce((s, r) => s + r.amount, 0);
    const buyFee = buy.reduce((s, r) => s + (r.fee ?? 0) + (r.tax ?? 0), 0);
    const sellFee = sell.reduce((s, r) => s + (r.fee ?? 0) + (r.tax ?? 0), 0);
    const netInflow = sellAmount - sellFee - (buyAmount + buyFee);
    const byStock = new Map<string, { name: string; buy: number; sell: number; buyAmt: number; sellAmt: number }>();
    for (const r of filtered) {
      const key = r.code;
      if (!byStock.has(key)) byStock.set(key, { name: r.name, buy: 0, sell: 0, buyAmt: 0, sellAmt: 0 });
      const s = byStock.get(key)!;
      if (r.direction === "买") {
        s.buy += r.quantity;
        s.buyAmt += r.amount;
      } else {
        s.sell += r.quantity;
        s.sellAmt += r.amount;
      }
    }
    return {
      buyAmount,
      sellAmount,
      buyFee,
      sellFee,
      netInflow,
      buyCount: buy.length,
      sellCount: sell.length,
      byStock: Array.from(byStock.entries())
        .map(([code, v]) => ({ code, ...v }))
        .sort((a, b) => b.buyAmt + b.sellAmt - (a.buyAmt + a.sellAmt))
        .slice(0, 10),
    };
  }, [filtered]);

  /** 图表数据：按日期汇总当日盈亏与累计盈亏，用于时间-收益率图 */
  const deliveryChartData = useMemo(() => {
    const byDate = new Map<
      string,
      { dayPl: number; trades: { code: string; name: string; dir: string; amount: number; pl: number }[] }
    >();
    for (const r of filtered) {
      const cost = r.amount + (r.fee ?? 0) + (r.tax ?? 0);
      const pl = r.direction === "买" ? -cost : r.amount - (r.fee ?? 0) - (r.tax ?? 0);
      if (!byDate.has(r.date)) {
        byDate.set(r.date, { dayPl: 0, trades: [] });
      }
      const row = byDate.get(r.date)!;
      row.dayPl += pl;
      row.trades.push({
        code: r.code,
        name: r.name,
        dir: r.direction,
        amount: r.amount,
        pl,
      });
    }
    const sortedDates = Array.from(byDate.keys()).sort();
    let cum = 0;
    let cumCost = 0; // 累计买入成本
    const result: {
      date: string;
      fullDate: string;
      dayPl: number;
      cumPl: number;
      returnRate: number | null;
      trades: { code: string; name: string; dir: string; amount: number; pl: number }[];
    }[] = [];
    for (const fullDate of sortedDates) {
      const row = byDate.get(fullDate)!;
      const dayCost = row.trades.filter((t) => t.dir === "买").reduce((s, t) => s + Math.abs(t.pl), 0);
      cum += row.dayPl;
      cumCost += dayCost;
      result.push({
        date: fullDate.slice(5),
        fullDate,
        dayPl: row.dayPl,
        cumPl: cum,
        returnRate: cumCost > 0 ? (cum / cumCost) * 100 : null,
        trades: row.trades,
      });
    }
    return result;
  }, [filtered]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const text = await file.text();
      const records = parseBrokerageCSV(text);
      if (records.length === 0) {
        setError("未能解析出有效记录，请确认文件为券商交割单 CSV 格式（含表头：业务日期、证券代码、证券名称、业务标志名称等）");
        e.target.value = "";
        return;
      }
      const res = await fetch("/api/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records, batchName: file.name.replace(/\.csv$/i, ""), fileName: file.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "导入失败");
      e.target.value = "";
      await fetchBatches();
    } catch (err: any) {
      setError(err.message || "导入失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBatch = async (batchId: number, batchName: string) => {
    if (!window.confirm(`确定删除「${batchName}」及其全部交割单记录吗？`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/delivery/batches/${batchId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      if (selectedBatchId === batchId) {
        setSelectedBatchId(null);
        setViewMode("shelf");
        setList([]);
      }
      await fetchBatches();
    } catch (e: any) {
      setError(e.message || "删除失败");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToShelf = () => {
    setSelectedBatchId(null);
    setViewMode("shelf");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 导入区 - 参考周报风格 */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-foreground">
            交割单导入
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            上传券商导出的交割单 CSV 文件（支持业务日期、证券代码、证券名称、业务标志名称、成交数量、成交价格等列）
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <label className="cursor-pointer">
              <input
                id="delivery-csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={loading}
              />
              <Button
                type="button"
                onClick={() => document.getElementById("delivery-csv-upload")?.click()}
                disabled={loading}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Upload className="mr-2 h-4 w-4" />
                {loading ? "处理中…" : "上传 CSV 文件"}
              </Button>
            </label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* 视图切换：书架 / 全部列表 */}
      <div className="flex rounded-lg border border-border bg-secondary/30 p-1 w-fit">
        <button
          type="button"
          onClick={() => setViewMode("shelf")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === "shelf" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <FolderOpen className="inline-block h-4 w-4 mr-1.5 align-middle" />
          书架
        </button>
        <button
          type="button"
          onClick={loadAllRecords}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${viewMode !== "shelf" && selectedBatchId === null ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <List className="inline-block h-4 w-4 mr-1.5 align-middle" />
          全部列表
        </button>
      </div>

      {/* 书架视图 - 按批次显示文件夹 */}
      {viewMode === "shelf" && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-foreground">
              交割单档案
              <span className="text-sm font-normal text-muted-foreground ml-2">
                共 {batches.length} 份
              </span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">点击文件夹查看明细，删除即移除该批全部记录</p>
          </CardHeader>
          <CardContent>
            {loading && batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">加载中…</p>
            ) : batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无交割单，请先上传 CSV 文件。</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {batches.map((b) => {
                  const year = b.dateRange?.min?.slice(0, 4) ?? "—";
                  return (
                    <div
                      key={b.id}
                      className="group relative rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-all hover:shadow-md"
                    >
                      <div className="flex items-center justify-between px-4 py-3 bg-primary/10 border-b border-border">
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">交割单</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBatch(b.id, b.name);
                          }}
                          className="opacity-60 hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                          aria-label="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadBatchRecords(b.id)}
                        className="w-full text-left p-4 block"
                      >
                        <span className="absolute top-12 right-2 text-6xl font-extralight text-muted-foreground/30 select-none">{year}</span>
                        <div className="flex items-center gap-2 mb-2">
                          <FolderOpen className="h-5 w-5 text-primary/70" />
                          <span className="font-medium text-foreground truncate">{b.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {b.dateRange ? `${b.dateRange.min} ~ ${b.dateRange.max}` : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{b.recordCount} 笔 · 买 {b.buyAmount.toFixed(0)} / 卖 {b.sellAmount.toFixed(0)}</p>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 批次明细视图 - 列表/宫格 */}
      {(viewMode === "list" || viewMode === "grid") && (
        <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleBackToShelf} className="text-muted-foreground hover:text-foreground">
                ← 返回书架
              </Button>
              <CardTitle className="text-lg font-semibold text-foreground">
                {selectedBatchId != null
                  ? (batches.find((b) => b.id === selectedBatchId)?.name ?? "交割单明细")
                  : "全部交割单"}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  共 {filtered.length} 条
                </span>
              </CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索代码、名称"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-40 pl-8 h-9 bg-secondary/50 border-border text-sm"
                />
              </div>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-24 h-9 text-xs border-border">
                  <SelectValue placeholder="年份" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部年份</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>{y}年</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="w-24 h-9 text-xs border-border">
                  <SelectValue placeholder="月份" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部月份</SelectItem>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>{m}月</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dirFilter} onValueChange={setDirFilter}>
                <SelectTrigger className="w-24 h-9 text-xs border-border">
                  <SelectValue placeholder="方向" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="买">买入</SelectItem>
                  <SelectItem value="卖">卖出</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "new" | "old")}>
                <SelectTrigger className="w-24 h-9 text-xs border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">新至旧</SelectItem>
                  <SelectItem value="old">旧至新</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex rounded-md border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`px-2.5 py-1.5 text-xs ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
                  aria-label="宫格"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`px-2.5 py-1.5 text-xs ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
                  aria-label="列表"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 分析统计 */}
          {filtered.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
              <div>
                <p className="text-xs text-muted-foreground">买入金额</p>
                <p className="text-sm font-mono font-semibold text-stock-down">{stats.buyAmount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">卖出金额</p>
                <p className="text-sm font-mono font-semibold text-stock-up">{stats.sellAmount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">净流入</p>
                <p className={`text-sm font-mono font-semibold ${stats.netInflow >= 0 ? "text-stock-up" : "text-stock-down"}`}>
                  {stats.netInflow >= 0 ? "+" : ""}{stats.netInflow.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">交易笔数</p>
                <p className="text-sm font-mono font-semibold">{stats.buyCount + stats.sellCount} 笔</p>
              </div>
            </div>
          )}

          {/* 交割单：时间-收益图，红盈绿亏 */}
          {deliveryChartData.length > 0 && (
            <div className="rounded-lg border border-border p-3 bg-card">
              <p className="text-sm font-medium text-foreground mb-2">时间-收益（X：日期 Y：累计盈亏）</p>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={deliveryChartData}
                    margin={{ top: 8, right: 8, bottom: 24, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="1 1" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 10 }}
                      width={48}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => (typeof v === "number" ? v.toFixed(0) : v)}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10 }}
                      width={40}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => (typeof v === "number" ? `${v.toFixed(1)}%` : v)}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 11, maxWidth: 320 }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ""}
                      formatter={(value: number, name: string, props: any) => {
                        if (name === "当日盈亏") return [value.toFixed(2), "当日盈亏(元)"];
                        if (name === "累计盈亏") return [value.toFixed(2), "累计盈亏(元)"];
                        return [value, name];
                      }}
                      labelStyle={{ fontWeight: 600 }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload;
                        return (
                          <div className="rounded border border-border bg-card p-2 shadow-md text-left">
                            <p className="font-semibold text-foreground mb-1">{p.fullDate}</p>
                            <p className="text-xs text-muted-foreground">
                              当日盈亏:{" "}
                              <span className={p.dayPl >= 0 ? "text-stock-down" : "text-stock-up"}>
                                {p.dayPl >= 0 ? "+" : ""}
                                {p.dayPl.toFixed(2)} 元
                              </span>
                              {" · "}累计: {p.cumPl >= 0 ? "+" : ""}
                              {p.cumPl.toFixed(2)} 元
                              {p.returnRate != null && ` · 收益率 ${p.returnRate >= 0 ? "+" : ""}${p.returnRate.toFixed(2)}%`}
                            </p>
                            {p.trades?.length > 0 && (
                              <div className="mt-1.5 border-t border-border pt-1.5 text-[10px] text-muted-foreground max-h-24 overflow-y-auto">
                                {p.trades.map((t: any, i: number) => (
                                  <div key={i} className="flex justify-between gap-2">
                                    <span>
                                      {t.dir}
                                      {t.code} {t.name}
                                    </span>
                                    <span className={t.pl >= 0 ? "text-stock-down" : "text-stock-up"}>
                                      {t.pl >= 0 ? "+" : ""}
                                      {t.pl.toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine yAxisId="left" y={0} stroke="hsl(var(--border))" strokeWidth={1} />
                    <Bar yAxisId="left" dataKey="dayPl" name="当日盈亏" radius={[2, 2, 0, 0]} maxBarSize={24}>
                      {deliveryChartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry.dayPl >= 0 ? "hsl(var(--stock-down))" : "hsl(var(--stock-up))"
                          }
                        />
                      ))}
                    </Bar>
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="cumPl"
                      name="累计盈亏"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      connectNulls
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="returnRate"
                      name="收益率"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1}
                      strokeDasharray="3 2"
                      dot={false}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                柱状：当日盈亏（红=盈利 绿=亏损） · 实线：累计盈亏(元) · 虚线：收益率(%)
              </p>
            </div>
          )}

          {loading && list.length === 0 ? (
            <p className="text-sm text-muted-foreground">加载中…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无记录，请先上传交割单 CSV 文件。</p>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((r) => (
                <div
                  key={r.id ?? `${r.date}-${r.code}-${r.direction}-${r.quantity}-${r.price}`}
                  className="rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-semibold text-foreground">{r.code}</span>
                    <span className={`text-xs font-medium ${r.direction === "买" ? "text-stock-down" : "text-stock-up"}`}>
                      {r.direction}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate mb-1">{r.name}</p>
                  <p className="text-xs text-muted-foreground mb-2">{r.date}</p>
                  <div className="flex justify-between text-xs">
                    <span>{r.quantity} 股 × {r.price.toFixed(2)}</span>
                    <span className="font-mono font-semibold">{r.amount.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent sticky top-0 z-10 bg-card">
                    <TableHead className="text-muted-foreground whitespace-nowrap">日期</TableHead>
                    <TableHead className="text-muted-foreground whitespace-nowrap">代码</TableHead>
                    <TableHead className="text-muted-foreground whitespace-nowrap">名称</TableHead>
                    <TableHead className="text-muted-foreground whitespace-nowrap">方向</TableHead>
                    <TableHead className="text-muted-foreground text-right whitespace-nowrap">数量</TableHead>
                    <TableHead className="text-muted-foreground text-right whitespace-nowrap">价格</TableHead>
                    <TableHead className="text-muted-foreground text-right whitespace-nowrap">金额</TableHead>
                    <TableHead className="text-muted-foreground text-right whitespace-nowrap">手续费</TableHead>
                    <TableHead className="text-muted-foreground text-right whitespace-nowrap">印花税</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id ?? `${r.date}-${r.code}-${r.direction}-${r.amount}-${r.quantity}`} className="border-border hover:bg-secondary/50">
                      <TableCell className="font-mono text-xs whitespace-nowrap">{r.date}</TableCell>
                      <TableCell className="font-mono text-sm whitespace-nowrap">{r.code}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.name}</TableCell>
                      <TableCell>
                        <span className={r.direction === "买" ? "text-stock-down font-medium" : "text-stock-up font-medium"}>
                          {r.direction}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.quantity}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.price.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {r.fee != null ? r.fee.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {r.tax != null ? r.tax.toFixed(2) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* 按股票汇总 - 分析辅助 */}
      {stats.byStock.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground">
              按股票汇总（当前筛选）
            </CardTitle>
            <p className="text-xs text-muted-foreground">买入/卖出数量及金额统计，便于复盘</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">代码</TableHead>
                    <TableHead className="text-muted-foreground">名称</TableHead>
                    <TableHead className="text-muted-foreground text-right">买入量</TableHead>
                    <TableHead className="text-muted-foreground text-right">买入额</TableHead>
                    <TableHead className="text-muted-foreground text-right">卖出量</TableHead>
                    <TableHead className="text-muted-foreground text-right">卖出额</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.byStock.map((s) => (
                    <TableRow key={s.code} className="border-border hover:bg-secondary/50">
                      <TableCell className="font-mono text-sm">{s.code}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-right font-mono text-stock-down">{s.buy}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{s.buyAmt.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-stock-up">{s.sell}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{s.sellAmt.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
