"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SignalRecord } from "@/lib/types";

interface SignalInputProps {
  onParsed: (records: SignalRecord[]) => void | Promise<void>;
  onSubmitted?: () => void;
  existingSectors?: string[];
  onDirtyChange?: (dirty: boolean) => void;
  fixedDate?: string; // YYYY-MM-DD，日历双击时固定日期
}

interface RowData {
  id: string;
  stock: string; // 格式: "代码 名称"
  tags: string; // 逗号分隔
  turnover: string;
  amount: string;
  debt_ratio: string;
}

function createEmptyRow(): RowData {
  return {
    id: crypto.randomUUID(),
    stock: "",
    tags: "",
    turnover: "",
    amount: "",
    debt_ratio: "",
  };
}

function rowToRecord(row: RowData, date: string): SignalRecord | null {
  if (!row.stock) return null;

  const turnover = row.turnover ? parseFloat(row.turnover) : null;
  const amount = row.amount ? parseFloat(row.amount) : null;
  const debt_ratio = row.debt_ratio ? parseFloat(row.debt_ratio) : null;
  
  // 从 stock 字段解析代码和名称
  const parts = row.stock.trim().split(/\s+/);
  if (parts.length < 2) {
    return null;
  }
  
  const code = parts[0].replace(/[^\d]/g, "").padStart(6, "0");
  const name = parts.slice(1).join(" ").trim();
  
  if (!code || !name) {
    return null;
  }

  return {
    date,
    stock: `${code} ${name}`,
    tags: row.tags.trim() || "未分类",
    sector_pattern: null,
    turnover: turnover != null && !isNaN(turnover) ? turnover : null,
    chg: null,
    amount: amount != null && !isNaN(amount) ? amount : null,
    debt_ratio: debt_ratio != null && !isNaN(debt_ratio) ? debt_ratio : null,
    score: 0,
    reason: [],
  };
}

export function SignalInput({
  onParsed,
  onSubmitted,
  onDirtyChange,
  fixedDate,
}: SignalInputProps) {
  const [rows, setRows] = useState<RowData[]>(() =>
    Array.from({ length: 1 }, createEmptyRow)
  );
  const [error, setError] = useState<string | null>(null);
  const [loadingCodes, setLoadingCodes] = useState<Set<string>>(new Set());
  const codeTimeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const dirtyRef = useRef(false);

  const fetchStockInfo = useCallback(
    async (rowId: string, code: string) => {
      const cleanCode = code.replace(/[^\d]/g, "").padStart(6, "0");
      if (cleanCode.length !== 6) return;

      setLoadingCodes((prev) => new Set(prev).add(rowId));

      try {
        const response = await fetch(
          `/api/tushare/stock-info?code=${cleanCode}`
        );

        if (response.ok) {
          const info = await response.json();
          setRows((prev) =>
            prev.map((r) => {
              if (r.id !== rowId) return r;
              const name = info.name || "";
              const stock = name ? `${cleanCode} ${name}` : r.stock;
              const tags = [
                info.industry || "",
                ...(info.concept || [])
              ].filter(Boolean).join(", ") || r.tags;
              
              return {
                ...r,
                stock,
                tags,
                turnover: r.turnover || (info.turnover != null ? info.turnover.toFixed(2) : "") || "",
                amount: r.amount || (info.amount != null ? info.amount.toFixed(2) : "") || "",
                debt_ratio: r.debt_ratio || (info.debt_ratio != null ? info.debt_ratio.toFixed(2) : "") || "",
              };
            })
          );
          setError(null);
        } else {
          setError(`股票代码 ${cleanCode} 未找到，请手动填写信息`);
        }
      } catch (err) {
        console.error("获取股票信息失败:", err);
        setError("获取股票信息失败，请手动填写");
      } finally {
        setLoadingCodes((prev) => {
          const next = new Set(prev);
          next.delete(rowId);
          return next;
        });
      }
    },
    []
  );

  const updateRow = useCallback(
    (id: string, field: keyof RowData, value: string) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const updated = { ...r, [field]: value };
          
          if (field === "stock" && value.trim().length >= 6) {
            const existingTimeout = codeTimeoutRefs.current.get(id);
            if (existingTimeout) clearTimeout(existingTimeout);
            
            const timeout = setTimeout(() => {
              const code = value.trim().split(/\s+/)[0] || "";
              if (code.length >= 6) fetchStockInfo(id, code);
              codeTimeoutRefs.current.delete(id);
            }, 500);
            
            codeTimeoutRefs.current.set(id, timeout);
          }
          
          return updated;
        })
      );
    },
    [fetchStockInfo]
  );

  useEffect(() => {
    return () => {
      codeTimeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
      codeTimeoutRefs.current.clear();
    };
  }, []);

  useEffect(() => {
    const hasRowContent = rows.some((r) =>
      r.stock || r.tags || r.turnover || r.amount || r.debt_ratio
    );
    if (dirtyRef.current !== hasRowContent) {
      dirtyRef.current = hasRowContent;
      onDirtyChange?.(hasRowContent);
    }
  }, [rows, onDirtyChange]);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, createEmptyRow()]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  const addSampleData = useCallback(() => {
    setRows([
      {
        id: crypto.randomUUID(),
        stock: "600519 贵州茅台",
        tags: "白酒, 高端消费",
        turnover: "3.2",
        amount: "85",
        debt_ratio: "25.8",
      },
      {
        id: crypto.randomUUID(),
        stock: "002371 北方华创",
        tags: "半导体, 设备国产替代",
        turnover: "6.5",
        amount: "42",
        debt_ratio: "38.5",
      },
    ]);
  }, []);

  async function handleSubmit() {
    setError(null);
    const records: SignalRecord[] = [];
    const date = fixedDate || new Date().toISOString().slice(0, 10);
    for (const row of rows) {
      const rec = rowToRecord(row, date);
      if (rec) records.push(rec);
    }
    if (records.length === 0) {
      setError("至少填入一条有效信号");
      return;
    }

    try {
      await onParsed(records);
      setRows(Array.from({ length: 1 }, createEmptyRow));
      onSubmitted?.();
    } catch (error: any) {
      setError(error.message || "保存数据失败");
    }
  }

  function handleClearAll() {
    setRows(Array.from({ length: 1 }, createEmptyRow));
    setError(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto overflow-y-visible rounded-md border border-border">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground min-w-[160px] whitespace-nowrap">
                股票（代码 名称）
              </TableHead>
              <TableHead className="text-muted-foreground min-w-[200px] whitespace-nowrap">
                标签（逗号分隔）
              </TableHead>
              <TableHead className="text-muted-foreground min-w-[90px] whitespace-nowrap">
                换手率%
              </TableHead>
              <TableHead className="text-muted-foreground min-w-[90px] whitespace-nowrap">
                市值(亿)
              </TableHead>
              <TableHead className="text-muted-foreground min-w-[100px] whitespace-nowrap">
                资产负债率%
              </TableHead>
              <TableHead className="text-muted-foreground min-w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={row.id} className="border-border hover:bg-secondary/50">
                <TableCell className="p-1">
                  <div className="relative">
                    <Input
                      value={row.stock}
                      onChange={(e) => updateRow(row.id, "stock", e.target.value)}
                      placeholder="600519 贵州茅台"
                      className="h-8 bg-secondary text-foreground border-border text-xs px-2"
                    />
                    {loadingCodes.has(row.id) && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        查询中...
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="p-1">
                  <Input
                    value={row.tags}
                    onChange={(e) => updateRow(row.id, "tags", e.target.value)}
                    placeholder="白酒, 高端消费"
                    className="h-8 bg-secondary text-foreground border-border text-xs px-2"
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Input
                    type="number"
                    step="0.01"
                    value={row.turnover}
                    onChange={(e) => updateRow(row.id, "turnover", e.target.value)}
                    placeholder="3.2"
                    className="h-8 bg-secondary text-foreground border-border text-xs font-mono px-2"
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Input
                    type="number"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) => updateRow(row.id, "amount", e.target.value)}
                    placeholder="85"
                    className="h-8 bg-secondary text-foreground border-border text-xs font-mono px-2"
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Input
                    type="number"
                    step="0.01"
                    value={row.debt_ratio}
                    onChange={(e) => updateRow(row.id, "debt_ratio", e.target.value)}
                    placeholder="45.2"
                    className="h-8 bg-secondary text-foreground border-border text-xs font-mono px-2"
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length <= 1}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    ×
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addRow}>
            + 添加行
          </Button>
          <Button variant="outline" size="sm" onClick={addSampleData}>
            填入示例
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearAll}>
            清空表格
          </Button>
        </div>
        <Button onClick={handleSubmit} className="bg-primary text-primary-foreground px-8">
          录入
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        填写"代码 名称"即可录入，如 "600519 贵州茅台"。标签支持多个，使用逗号分隔。
      </p>
    </div>
  );
}