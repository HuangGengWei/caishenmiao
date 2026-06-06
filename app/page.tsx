"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Wheat, TrendingUp, FileText } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StocksPage } from "@/components/stocks-page";
import { HistoryPanel } from "@/components/history-panel";
import type { SignalRecord } from "@/lib/types";
import {
  addRecords,
  getAllRecords,
  clearAllRecords,
} from "@/lib/store";

export default function Page() {
  const [activeTab, setActiveTab] = useState("history");
  const [allRecords, setAllRecords] = useState<SignalRecord[]>([]);
  const [hasUnsavedInput, setHasUnsavedInput] = useState(false);

  useEffect(() => {
    getAllRecords().then(setAllRecords);
  }, []);

  const handleParsed = useCallback(
    async (records: SignalRecord[]) => {
      try {
        const updated = await addRecords(records);
        setAllRecords(updated);
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
  }, []);

  const existingTags = useMemo(
    () => Array.from(new Set(allRecords.flatMap((r) => (r.tags || "").split(/[,，]/).map((t) => t.trim()).filter(Boolean)))).sort(),
    [allRecords]
  );

  function handleTabChange(next: string) {
    if (activeTab === "history" && hasUnsavedInput && next !== "history") {
      if (!window.confirm("当前录入表格中有未保存的数据，确定要离开近30天汇总页面吗？")) return;
    }
    setActiveTab(next);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[140rem] w-full items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md">
              <Wheat className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                啄米
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                精准捕捉 · 积少成多
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Link href="/bloggers">
                <Button variant="outline" size="sm" className="gap-2">
                  <TrendingUp className="h-4 w-4" />
                  博主分析
                </Button>
              </Link>
              <Link href="/delivery">
                <Button variant="outline" size="sm" className="gap-2">
                  <FileText className="h-4 w-4" />
                  交割单
                </Button>
              </Link>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-right">
              <p className="text-xs text-muted-foreground">信号库</p>
              <p className="text-sm font-mono font-bold text-primary">
                {allRecords.length} 条
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-[140rem] w-full px-4 py-6 lg:px-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col gap-6">
          <TabsList className="bg-secondary border border-border self-start">
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
              个股明细
            </TabsTrigger>
          </TabsList>

          {/* History tab */}
          <TabsContent value="history" className="mt-0">
            <HistoryPanel
              records={allRecords}
              existingSectors={existingTags}
              onClear={handleClear}
              onAddRecords={handleParsed}
              onUnsavedChange={setHasUnsavedInput}
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
        <div className="mx-auto max-w-[140rem] w-full px-4 py-6 lg:px-8">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-amber-500">
              <Wheat className="h-4 w-4" />
              <span className="text-sm font-semibold">啄米</span>
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-md">
              金克木为财，啄米生财。每一次精准的啄取，都是财富的积累。
            </p>
            <p className="text-xs text-muted-foreground text-center">
              本工具仅用于复盘记录与数据统计，不构成任何投资建议。投资有风险，操作需谨慎。
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
