"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { SignalRecord, SectorScreenshot } from "@/lib/types";
import { SignalInput } from "@/components/signal-input";
import {
  getStockHistory,
  getSectorStats,
  exportToCSV,
  exportToJSON,
  getSectorScreenshotsForDate,
  upsertSectorScreenshot,

} from "@/lib/store";

interface HistoryPanelProps {
  records: SignalRecord[];
  existingSectors?: string[];
  onClear: () => void;
  onAddRecords?: (records: SignalRecord[]) => void;
  onUnsavedChange?: (dirty: boolean) => void;
}

function getMonthDays(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  // 0=Sun, 1=Mon ... 6=Sat — shift so Mon=0
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function formatMonth(year: number, month: number) {
  return `${year}年${month + 1}月`;
}

// 判断是否为交易日（排除周六日和节假日）
function isTradingDay(dateStr: string, nonTradingDays: Set<string>): boolean {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
  // 周六日不是交易日
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  // 检查是否在非交易日列表中（节假日）
  return !nonTradingDays.has(dateStr);
}

// 获取非交易日的提示信息
function getNonTradingDayTip(dateStr: string, nonTradingDays: Set<string>): string {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0) return "周日，非交易日";
  if (dayOfWeek === 6) return "周六，非交易日";
  if (nonTradingDays.has(dateStr)) return "节假日，非交易日";
  return "非交易日";
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

interface DayCellData {
  count: number;
  records: SignalRecord[];
}

export function HistoryPanel({
  records,
  existingSectors = [],
  onClear,
  onAddRecords,
  onUnsavedChange,
}: HistoryPanelProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [previewShot, setPreviewShot] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [inputOpen, setInputOpen] = useState(false);
  const [hasUnsavedInput, setHasUnsavedInput] = useState(false);
  const [sectorShotVersion, setSectorShotVersion] = useState(0);
  const [sectorScreenshots, setSectorScreenshots] = useState<
    SectorScreenshot[]
  >([]);
  const [nonTradingDays, setNonTradingDays] = useState<Set<string>>(new Set());

  // 加载交易日历数据
  useEffect(() => {
    const loadTradeCal = async () => {
      try {
        // 获取当前月份前后各3个月的数据
        const startDate = new Date(viewYear, viewMonth - 3, 1);
        const endDate = new Date(viewYear, viewMonth + 4, 0);
        
        const startStr = `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, "0")}${String(startDate.getDate()).padStart(2, "0")}`;
        const endStr = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, "0")}${String(endDate.getDate()).padStart(2, "0")}`;
        
        const response = await fetch(
          `/api/tushare/trade-cal?startDate=${startStr}&endDate=${endStr}`
        );
        if (response.ok) {
          const data = await response.json();
          setNonTradingDays(new Set(data.nonTradingDays || []));
        }
      } catch (error) {
        console.error("加载交易日历失败:", error);
      }
    };
    loadTradeCal();
  }, [viewYear, viewMonth]);

  // Group records by date
  const dateMap = useMemo(() => {
    const map = new Map<string, DayCellData>();
    for (const r of records) {
      if (!map.has(r.date)) {
        map.set(r.date, { count: 0, records: [] });
      }
      const d = map.get(r.date)!;
      d.count++;
      d.records.push(r);
    }
    return map;
  }, [records]);

  const sectorStats = useMemo(() => getSectorStats(records), [records]);

  // Build calendar grid
  const totalDays = getMonthDays(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const cells: (null | { day: number; dateStr: string; data: DayCellData | undefined })[] = [];

  // Leading empty cells
  for (let i = 0; i < firstDay; i++) cells.push(null);

  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, dateStr, data: dateMap.get(dateStr) });
  }

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
    setSelectedDate(null);
  };

  function handleDownload(mode: "csv" | "json") {
    const content = mode === "csv" ? exportToCSV(records) : exportToJSON(records);
    const blob = new Blob([content], {
      type: mode === "csv" ? "text/csv;charset=utf-8" : "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signal_records_30d.${mode}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const uniqueDates = [...new Set(records.map((r) => r.date))];
  const stockHistory = getStockHistory(records);

  const selectedDateData = selectedDate ? dateMap.get(selectedDate) : undefined;
  const selectedRecords = selectedSector
    ? dateMap.get(selectedSector.split("|")[0])?.records ?? []
    : selectedDateData?.records ?? [];

  const selectedSectorName = selectedSector
    ? selectedSector.split("|")[1]
    : null;

  // 加载选中日期的板块截图
  useEffect(() => {
    if (selectedDate) {
      getSectorScreenshotsForDate(selectedDate).then(setSectorScreenshots);
    } else {
      setSectorScreenshots([]);
    }
  }, [selectedDate, sectorShotVersion]);

  // 当前选中日期下的板块聚合（名称 + 计数 + 均分），并且合并当天已上传截图但可能暂无个股的板块
  const selectedDateSectors =
    selectedDate && selectedDateData
      ? (() => {
          const sectorMap = new Map<string, { count: number }>();
          for (const r of selectedDateData.records) {
            for (const s of r.sector) {
              const existing = sectorMap.get(s) ?? { count: 0 };
              existing.count += 1;
              sectorMap.set(s, existing);
            }
          }

          // 把当天仅有截图、但当日可能没有个股记录的板块也合并进来
          for (const shot of sectorScreenshots) {
            if (!sectorMap.has(shot.sector)) {
              sectorMap.set(shot.sector, { count: 0 });
            }
          }

          return Array.from(sectorMap.entries())
            .map(([sector, { count }]) => {
              const shot = sectorScreenshots.find(
                (s) => s.sector === sector
              );
              return {
                sector,
                count,
                imageDataUrl: shot?.imageDataUrl ?? null,
              };
            })
            .sort((a, b) => b.count - a.count || a.sector.localeCompare(b.sector));
        })()
      : [];

  const handlePasteSectorShot = useCallback(
    async (e: React.ClipboardEvent<HTMLDivElement>, sector: string) => {
      if (!selectedDate) return;
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = async () => {
            if (typeof reader.result === "string") {
              await upsertSectorScreenshot({
                date: selectedDate,
                sector,
                imageDataUrl: reader.result as string,
              });
              setSectorShotVersion((v) => v + 1);
            }
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    },
    [selectedDate]
  );

  // Heat color based on count
  function getCellBg(data: DayCellData | undefined) {
    if (!data) return "bg-muted/40";
    if (data.count >= 5) return "bg-primary/20";
    if (data.count >= 3) return "bg-primary/12";
    if (data.count >= 1) return "bg-primary/8";
    return "bg-muted/40";
  }

  // Collect unique sectors for a day cell（用于左侧日历小标签）
  function getDaySectors(data: DayCellData | undefined): string[] {
    if (!data) return [];
    const sectorSet = new Set<string>();
    for (const r of data.records) {
      for (const s of r.sector) {
        sectorSet.add(s);
      }
    }
    return [...sectorSet];
  }

  // 即使没有数据也显示日历，方便用户点击日期添加数据

  return (
    <div className="flex flex-col gap-6">
      {/* Header bar */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg font-semibold text-foreground">
            <span>
              近30天信号库
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {records.length} 条 / {uniqueDates.length} 天 / {stockHistory.length} 只去重
              </span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload("csv")}
                className="text-xs border-border text-muted-foreground hover:text-foreground bg-transparent"
              >
                下载CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload("json")}
                className="text-xs border-border text-muted-foreground hover:text-foreground bg-transparent"
              >
                下载JSON
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onClear}
                className="text-xs"
              >
                清空
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Calendar + Detail side by side */}
      <div className="grid gap-6 lg:grid-cols-5 items-stretch">
        {/* Calendar */}
        <Card className="border-border bg-card lg:col-span-3 h-full flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={prevMonth}
                className="text-muted-foreground hover:text-foreground"
                aria-label="上一月"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </Button>
              <CardTitle className="text-base font-semibold text-foreground">
                {formatMonth(viewYear, viewMonth)}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={nextMonth}
                className="text-muted-foreground hover:text-foreground"
                aria-label="下一月"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="text-center text-xs font-medium text-muted-foreground py-1"
                >
                  {w}
                </div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((cell, i) => {
                if (!cell) {
                  return <div key={`empty-${i}`} className="min-h-[72px]" />;
                }
                const isToday = cell.dateStr === today.toISOString().slice(0, 10);
                const isSelected = cell.dateStr === selectedDate;
                const hasData = !!cell.data;
                const isTrading = isTradingDay(cell.dateStr, nonTradingDays);
                const sectors = getDaySectors(cell.data);
                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    disabled={!isTrading}
                    onClick={() => {
                      if (!isTrading) return;
                      if (isSelected) {
                        // 如果当前已经选中该日期：
                        // 1）正在看具体板块个股 -> 只清空板块，回到该日板块列表
                        // 2）正在看该日板块列表 -> 再点一次则清空日期选择
                        if (selectedSector) {
                          setSelectedSector(null);
                        } else {
                          setSelectedDate(null);
                        }
                      } else {
                        // 选择一个新的日期，默认进入板块列表视图
                        setSelectedDate(cell.dateStr);
                        setSelectedSector(null);
                      }
                    }}
                    onDoubleClick={() => {
                      if (!isTrading || !onAddRecords) return;
                      setSelectedDate(cell.dateStr);
                      setSelectedSector(null);
                      setInputOpen(true);
                    }}
                    title={!isTrading ? getNonTradingDayTip(cell.dateStr, nonTradingDays) : undefined}
                    className={`
                      min-h-[72px] rounded-lg flex flex-col items-start p-1.5 gap-0.5 text-xs transition-all relative
                      ${getCellBg(cell.data)}
                      ${isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}
                      border border-border/60
                      ${!isTrading 
                        ? "opacity-50 cursor-not-allowed bg-muted/20" 
                        : hasData 
                          ? "cursor-pointer hover:ring-1 hover:ring-primary/40 hover:shadow-sm" 
                          : "cursor-default"
                      }
                    `}
                    aria-label={`${cell.dateStr}${cell.data ? `，${cell.data.count}条信号` : ""}${!isTrading ? `，${getNonTradingDayTip(cell.dateStr, nonTradingDays)}` : ""}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1">
                        <span className={`font-mono text-[11px] leading-none ${hasData ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                          {cell.day}
                        </span>
                        {!isTrading && (
                          <span className="text-[9px] text-muted-foreground/70" title={getNonTradingDayTip(cell.dateStr, nonTradingDays)}>
                            休
                          </span>
                        )}
                      </div>
                      {cell.data && (
                        <span className="flex items-center gap-0.5">
                          <span className="text-[10px] font-mono leading-none text-primary font-bold">
                            {cell.data.count}
                          </span>
                        </span>
                      )}
                    </div>
                    {sectors.length > 0 && (
                      <div className="flex flex-col gap-px w-full mt-0.5 overflow-hidden">
                        {sectors.map((s) => (
                          <div
                            key={s}
                            role={isTrading ? "button" : undefined}
                            tabIndex={isTrading ? 0 : undefined}
                            onClick={(e) => {
                              if (!isTrading) return;
                              e.stopPropagation();
                              setSelectedDate(cell.dateStr);
                              setSelectedSector(`${cell.dateStr}|${s}`);
                            }}
                            onKeyDown={(e) => {
                              if (!isTrading) return;
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedDate(cell.dateStr);
                                setSelectedSector(`${cell.dateStr}|${s}`);
                              }
                            }}
                            className={`text-[10px] leading-none font-semibold w-16 h-5 flex items-center justify-center rounded px-0.5 truncate transition-all ${
                              !isTrading 
                                ? "opacity-50 cursor-not-allowed"
                                : "cursor-pointer"
                            } ${
                              s === "半导体"
                                ? "bg-blue-100 text-blue-700"
                                : s === "白酒"
                                  ? "bg-amber-100 text-amber-700"
                                  : s === "新能源"
                                    ? "bg-green-100 text-green-700"
                                    : s === "锂电池"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : s === "消费"
                                        ? "bg-pink-100 text-pink-700"
                                        : s === "医药"
                                          ? "bg-red-100 text-red-700"
                                          : s === "房地产"
                                            ? "bg-yellow-100 text-yellow-700"
                                            : s === "金融"
                                              ? "bg-purple-100 text-purple-700"
                                              : s === "科技"
                                                ? "bg-cyan-100 text-cyan-700"
                                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {s}
                          </div>
                        ))}
                        {cell.data &&
                          (() => {
                            const totalSectors = new Set(
                              cell.data.records.flatMap((r) => r.sector)
                            ).size;
                            return totalSectors > 3 ? (
                              <span className="text-[9px] leading-tight text-muted-foreground/60">
                                +{totalSectors - 3}
                              </span>
                            ) : null;
                          })()}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-muted/40 border border-border" />
                <span className="text-xs text-muted-foreground">无数据</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-primary/8" />
                <span className="text-xs text-muted-foreground">1-2条</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-primary/12" />
                <span className="text-xs text-muted-foreground">3-4条</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-primary/20" />
                <span className="text-xs text-muted-foreground">5+条</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Day detail or summary */}
        <Card className="border-border bg-card lg:col-span-2 h-full flex flex-col">
          <CardHeader className="pb-3 flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-foreground">
              {selectedDate
                ? selectedSector
                  ? `${selectedDate} / ${selectedSector.split("|")[1]} 板块个股`
                  : `${selectedDate} 板块概览`
                : "日期详情"}
            </CardTitle>
            {selectedSector && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedSector(null)}
              >
                返回板块列表
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {selectedSector ? (
              <div className="flex flex-col gap-3">
                <div className="text-sm font-semibold text-foreground mb-1">
                  {selectedSectorName} 板块个股
                </div>
                <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
                  {selectedRecords
                    .filter((r) =>
                      r.sector.includes(selectedSector.split("|")[1])
                    )
                    .sort((a, b) => a.code.localeCompare(b.code))
                    .map((r, i) => (
                      <div
                        key={`${r.code}-${i}`}
                        className="group relative flex items-start justify-between gap-4 rounded-lg border-2 border-border bg-gradient-to-br from-card to-secondary/30 px-4 py-3 shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
                      >
                        <div className="flex flex-col gap-2 min-w-0 flex-1">
                          {/* 第一行：代码、名称、标签 */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-base font-bold text-foreground tracking-wide">
                              {r.code}
                            </span>
                            <span className="font-semibold text-base text-foreground">
                              {r.name}
                            </span>
                            {r.sector_pattern && (
                              <Badge
                                variant="outline"
                                className={`text-xs px-2 py-0.5 h-6 font-semibold ${
                                  r.sector_pattern === "水下拉水上"
                                    ? "border-stock-up/60 text-stock-up bg-stock-up/10"
                                    : "border-primary/60 text-primary bg-primary/10"
                                }`}
                              >
                                {r.sector_pattern}
                              </Badge>
                            )}
                          </div>
                          
                          {/* 第二行：板块标签 */}
                          <div className="flex items-center flex-wrap gap-1.5">
                            {r.sector.map((s) => (
                              <span
                                key={s}
                                className="text-xs px-2 py-1 rounded-md bg-primary/15 text-primary font-medium border border-primary/20"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                          
                          {/* 第三行：关键指标 */}
                          <div className="flex items-center gap-4 flex-wrap mt-1">
                            {r.chg !== null && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">涨跌</span>
                                <span
                                  className={`text-sm font-bold ${
                                    r.chg >= 0 ? "text-stock-up" : "text-stock-down"
                                  }`}
                                >
                                  {r.chg >= 0 ? "+" : ""}{r.chg.toFixed(2)}%
                                </span>
                              </div>
                            )}
                            {r.turnover !== null && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">换手</span>
                                <span className="text-sm font-semibold text-foreground">
                                  {r.turnover.toFixed(2)}%
                                </span>
                              </div>
                            )}
                            {r.amount !== null && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">市值</span>
                                <span className="text-sm font-semibold text-foreground">
                                  {r.amount.toFixed(2)} 亿
                                </span>
                              </div>
                            )}
                            {r.debt_ratio != null && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">负债率</span>
                                <span className="text-sm font-semibold text-foreground">
                                  {r.debt_ratio.toFixed(2)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : selectedDate ? (
              <div className="flex flex-col gap-4">
                {selectedRecords && selectedRecords.length > 0 ? (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">当日信号数</span>
                    <span className="font-mono font-bold text-foreground">
                      {selectedRecords.length}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    该日期暂无信号记录，可在下方直接录入。
                  </p>
                )}
                <div className="flex flex-col gap-3 flex-1 min-h-0">
                  <div className="text-sm font-semibold text-foreground">
                    板块列表（点击板块查看个股）
                  </div>
                  <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
                        {selectedDateSectors.length > 0 ? (
                      selectedDateSectors.map((s) => (
                        <div
                          key={s.sector}
                          className="rounded-md border border-border bg-secondary/40 px-3 py-2 flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() =>
                                selectedDate &&
                                setSelectedSector(`${selectedDate}|${s.sector}`)
                              }
                              className="text-sm font-medium text-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
                            >
                              {s.sector}
                            </button>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-primary/15 text-primary border-0 text-[11px]">
                                {s.count} 只
                              </Badge>
                            </div>
                          </div>
                          <div
                            className="mt-1 rounded-md border border-dashed border-border/60 bg-muted/40 flex items-center justify-center text-[11px] text-muted-foreground overflow-hidden max-h-64"
                            onPaste={(e) => handlePasteSectorShot(e, s.sector)}
                            tabIndex={0}
                          >
                            {s.imageDataUrl ? (
                              <button
                                type="button"
                                className="w-full h-full flex items-center justify-center"
                                onClick={() =>
                                  setPreviewShot({
                                    url: s.imageDataUrl as string,
                                    title: `${selectedDate ?? ""} ${s.sector}`.trim(),
                                  })
                                }
                              >
                                <img
                                  src={s.imageDataUrl}
                                  alt={`${s.sector} 分时截图`}
                                  className="w-full h-auto object-contain cursor-zoom-in"
                                />
                              </button>
                            ) : (
                              "分时截图（选中此区域后直接 Ctrl+V 粘贴图片上传）"
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        当前日期下暂无板块统计，可先录入当日个股信号。
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                点击日历中的日期，在右侧查看或录入当日信号与板块分时截图。
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sector frequency chips */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground">
            板块统计（近30天出现次数排名）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {sectorStats.slice(0, 15).map((s) => (
              <div
                key={s.sector}
                className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2"
              >
                <span className="text-sm font-medium text-foreground">
                  {s.sector}
                </span>
                <Badge className="bg-primary/20 text-primary border-0 text-xs">
                  {s.count} 次
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Signal input dialog (opened via double-click on calendar date) */}
      {onAddRecords && selectedDate && (
        <Dialog
          open={inputOpen}
          onOpenChange={(open) => {
            if (!open && hasUnsavedInput) {
              if (!window.confirm("检测到当前录入表格中有未保存的数据，确定要关闭吗？")) {
                return;
              }
            }
            setInputOpen(open);
            if (!open) {
              setHasUnsavedInput(false);
              onUnsavedChange?.(false);
            }
          }}
        >
          <DialogContent className="w-[95vw] max-w-[95vw] h-[90vh] max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>信号数据录入</DialogTitle>
              <DialogDescription>
                {selectedDate} 的个股与板块数据，可在此一次性录入或修改。
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 flex-1 overflow-auto pr-2 min-h-0">
              <SignalInput
                onParsed={onAddRecords}
                fixedDate={selectedDate}
                existingSectors={existingSectors}
                onSubmitted={() => {
                  setInputOpen(false);
                  setHasUnsavedInput(false);
                  onUnsavedChange?.(false);
                }}
                onDirtyChange={(dirty) => {
                  setHasUnsavedInput(dirty);
                  onUnsavedChange?.(dirty);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Screenshot preview overlay */}
      {previewShot && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
          onClick={() => setPreviewShot(null)}
        >
          <div
            className="max-w-5xl w-full max-h-[90vh] px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
              <span className="truncate max-w-[70%]">{previewShot.title}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs border-border bg-background/80"
                onClick={() => setPreviewShot(null)}
              >
                关闭
              </Button>
            </div>
            <div className="bg-background rounded-md overflow-auto max-h-[85vh] border border-border">
              <img
                src={previewShot.url}
                alt={previewShot.title}
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
