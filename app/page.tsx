"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Landmark } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReviewAI } from "@/components/review-ai";
import { StocksPage } from "@/components/stocks-page";
import { HistoryPanel } from "@/components/history-panel";
import type { SignalRecord } from "@/lib/types";
import {
  addRecords,
  getAllRecords,
  clearAllRecords,
  getLast30DaysRecords,
} from "@/lib/store";

export default function Page() {
  const [activeTab, setActiveTab] = useState("history");
  const [allRecords, setAllRecords] = useState<SignalRecord[]>([]);

  useEffect(() => {
    getAllRecords().then(setAllRecords);
  }, []);

  const handleParsed = useCallback(
    async (records: SignalRecord[]) => {
      try {
        const updated = await addRecords(records);
        setAllRecords(updated);
        const last30Data = await getLast30DaysRecords();
        setLast30(last30Data);
        setActiveTab("history");
      } catch (error: any) {
        console.error("保存数据失败:", error);
        alert(`保存数据失败: ${error.message || "未知错误"}`);
      }
    },
    []
  );

  const handleClear = useCallback(async () => {
    await clearAllRecords();
    setAllRecords([]);
    const last30Data = await getLast30DaysRecords();
    setLast30(last30Data);
  }, []);

  const [last30, setLast30] = useState<SignalRecord[]>([]);

  useEffect(() => {
    getLast30DaysRecords().then(setLast30);
  }, []);

  const existingSectors = useMemo(
    () => Array.from(new Set(allRecords.flatMap((r) => r.sector))).sort(),
    [allRecords]
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[140rem] w-full items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-500">
              <Landmark className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                财神庙
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                板块分时 / 可视化
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">信号库</p>
              <p className="text-sm font-mono font-bold text-primary">
                {allRecords.length} 条
              </p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-right">
              <p className="text-xs text-muted-foreground">近30天</p>
              <p className="text-sm font-mono font-bold text-foreground">
                {last30.length} 条
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-[140rem] w-full px-4 py-6 lg:px-6">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-col gap-6"
        >
          <TabsList className="bg-secondary border border-border self-start">
            <TabsTrigger
              value="ai"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              复盘智囊
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              近30天汇总
            </TabsTrigger>
            <TabsTrigger
              value="stocks"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              个股
            </TabsTrigger>
          </TabsList>

          {/* 复盘智囊 tab */}
          <TabsContent value="ai" className="mt-0">
            <ReviewAI records={allRecords} />
          </TabsContent>

          {/* History tab */}
          <TabsContent value="history" className="mt-0">
            <HistoryPanel
              records={last30}
              existingSectors={existingSectors}
              onClear={handleClear}
              onAddRecords={handleParsed}
            />
          </TabsContent>

          {/* Stocks tab */}
          <TabsContent value="stocks" className="mt-0">
            <StocksPage records={allRecords} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-12">
        <div className="mx-auto max-w-[140rem] w-full px-4 py-4 lg:px-8">
          <p className="text-xs text-muted-foreground text-center">
            本工具仅用于复盘记录与数据统计，不构成任何投资建议。投资有风险，操作需谨慎。
          </p>
        </div>
      </footer>
    </div>
  );
}
