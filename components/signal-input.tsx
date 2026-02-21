"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
import type { SignalRecord } from "@/lib/types";

interface SignalInputProps {
  onParsed: (records: SignalRecord[]) => void | Promise<void>;
  fixedDate?: string; // 如果提供，则锁定为该日期并隐藏头部日期选择
  onSubmitted?: () => void; // 成功提交后回调（例如关闭弹窗）
  existingSectors?: string[]; // 历史录入过的板块选项，用于下拉建议
}

interface RowData {
  id: string;
  code: string;
  name: string;
  sector: string;
  sector_pattern: string;
  turnover: string;
  chg: string;
  amount: string;
  debt_ratio: string;
}

function createEmptyRow(): RowData {
  return {
    id: crypto.randomUUID(),
    code: "",
    name: "",
    sector: "",
    sector_pattern: "",
    turnover: "",
    chg: "",
    amount: "",
    debt_ratio: "",
  };
}

function rowToRecord(row: RowData, date: string): SignalRecord | null {
  if (!row.code && !row.name) return null;

  const turnover = row.turnover ? parseFloat(row.turnover) : null;
  const chg = row.chg ? parseFloat(row.chg) : null;
  const amount = row.amount ? parseFloat(row.amount) : null;
  const debt_ratio = row.debt_ratio ? parseFloat(row.debt_ratio) : null;
  const sectors = row.sector
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const sectorPattern =
    row.sector_pattern === "水下拉水上" || row.sector_pattern === "波动三角收窄"
      ? row.sector_pattern
      : null;

  // 确保所有字段都是有效的
  const code = row.code.replace(/[^\d]/g, "").padStart(6, "0");
  const name = row.name.trim();
  
  if (!code || !name) {
    console.error("Invalid record: missing code or name", { code, name });
    return null;
  }

  return {
    date,
    code,
    name,
    sector: sectors.length > 0 ? sectors : ["未分类"], // 确保 sector 不为空数组
    sector_pattern: sectorPattern,
    turnover: turnover != null && !isNaN(turnover) ? turnover : null,
    chg: chg != null && !isNaN(chg) ? chg : null,
    amount: amount != null && !isNaN(amount) ? amount : null,
    debt_ratio: debt_ratio != null && !isNaN(debt_ratio) ? debt_ratio : null,
    score: 0,
    reason: [],
  };
}

export function SignalInput({ onParsed, fixedDate, onSubmitted, existingSectors = [] }: SignalInputProps) {
  const [date, setDate] = useState(
    () => fixedDate || new Date().toISOString().slice(0, 10)
  );
  const [rows, setRows] = useState<RowData[]>(() =>
    Array.from({ length: 1 }, createEmptyRow)
  );
  const [error, setError] = useState<string | null>(null);
  const [loadingCodes, setLoadingCodes] = useState<Set<string>>(new Set());
  const codeTimeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // 根据股票代码自动填充信息
  const fetchStockInfo = useCallback(
    async (rowId: string, code: string) => {
      const cleanCode = code.replace(/[^\d]/g, "").padStart(6, "0");
      if (cleanCode.length !== 6) {
        return;
      }

      setLoadingCodes((prev) => new Set(prev).add(rowId));

      try {
        // 转换日期格式：YYYY-MM-DD -> YYYYMMDD
        const tradeDate = date.replace(/-/g, "");
        const response = await fetch(
          `/api/tushare/stock-info?code=${cleanCode}&tradeDate=${tradeDate}`
        );

        if (response.ok) {
          const info = await response.json();
          setRows((prev) =>
            prev.map((r) => {
              if (r.id !== rowId) return r;
              // 只填充空字段，不覆盖已有数据
              const updated = {
                ...r,
                name: r.name || info.name || "",
                chg: r.chg || (info.chg != null ? info.chg.toFixed(2) : "") || "",
                turnover: r.turnover || (info.turnover != null ? info.turnover.toFixed(2) : "") || "",
                amount: r.amount || (info.amount != null ? info.amount.toFixed(2) : "") || "",
                debt_ratio: r.debt_ratio || (info.debt_ratio != null ? info.debt_ratio.toFixed(2) : "") || "",
                sector: r.sector || (info.industry ? String(info.industry) : r.sector),
              };
              
              return updated;
            })
          );
          // 清除之前的错误提示
          setError(null);
        } else {
          const errorData = await response.json();
          // 如果股票代码不存在，提示用户手动填写
          if (response.status === 404) {
            setError(`股票代码 ${cleanCode} 未找到，请检查代码是否正确或手动填写信息`);
          } else {
            setError(errorData.error || "获取股票信息失败，请手动填写");
          }
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
    [date]
  );

  const updateRow = useCallback(
    (id: string, field: keyof RowData, value: string | boolean) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const updated = { ...r, [field]: value };
          
          // 当代码字段更新时，延迟查询股票信息
          if (field === "code" && typeof value === "string") {
            // 清除之前的定时器
            const existingTimeout = codeTimeoutRefs.current.get(id);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
            }
            
            // 设置新的定时器（防抖：500ms）
            const timeout = setTimeout(() => {
              if (value.trim().length >= 6) {
                fetchStockInfo(id, value);
              }
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

  // 清理定时器
  useEffect(() => {
    return () => {
      codeTimeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
      codeTimeoutRefs.current.clear();
    };
  }, []);

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
        code: "600519",
        name: "贵州茅台",
        sector: "白酒",
        sector_pattern: "水下拉水上",
        turnover: "3.2",
        chg: "2.5",
        amount: "85",
        debt_ratio: "25.8",
      },
      {
        id: crypto.randomUUID(),
        code: "002371",
        name: "北方华创",
        sector: "半导体",
        sector_pattern: "波动三角收窄",
        turnover: "6.5",
        chg: "5.1",
        amount: "42",
        debt_ratio: "38.5",
      },
      {
        id: crypto.randomUUID(),
        code: "300750",
        name: "宁德时代",
        sector: "锂电池、新能源",
        sector_pattern: "水下拉水上",
        turnover: "8.1",
        chg: "3.8",
        amount: "120",
        debt_ratio: "52.3",
      },
    ]);
  }, []);

  // 注意：当前版本不再处理板块分时截图，仅通过表格录入文字与数值数据。

  async function handleSubmit() {
    setError(null);
    const records: SignalRecord[] = [];
    for (const row of rows) {
      const rec = rowToRecord(row, date);
      if (rec) records.push(rec);
    }
    if (records.length === 0) {
      setError("至少填入一条有效信号（需填写代码或名称）");
      return;
    }

    try {
      await onParsed(records);
      // 提交成功后清空表格
      setRows(Array.from({ length: 1 }, createEmptyRow));
      // 如有需要，通知父组件（例如关闭弹窗）
      if (onSubmitted) {
        onSubmitted();
      }
    } catch (error: any) {
      setError(error.message || "保存数据失败，请重试");
    }
  }

  function handleClearAll() {
    setRows(Array.from({ length: 1 }, createEmptyRow));
    setError(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {!fixedDate && (
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-foreground">
            信号数据录入
          </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-normal text-muted-foreground">
                日期
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-40 bg-secondary text-foreground border-border"
              />
          </div>
            </div>
          )}
        <div className="overflow-x-auto overflow-y-visible rounded-md border border-border">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground min-w-[100px] whitespace-nowrap">
                  代码
                </TableHead>
                <TableHead className="text-muted-foreground min-w-[100px] whitespace-nowrap">
                  名称
                </TableHead>
                <TableHead className="text-muted-foreground min-w-[140px] whitespace-nowrap">
                  板块
                </TableHead>
                <TableHead className="text-muted-foreground min-w-[130px] whitespace-nowrap">
                  板块分时
                </TableHead>
                <TableHead className="text-muted-foreground min-w-[90px] whitespace-nowrap">
                  换手率%
                </TableHead>
                <TableHead className="text-muted-foreground min-w-[90px] whitespace-nowrap">
                  涨跌幅%
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
                <TableRow
                  key={row.id}
                  className="border-border hover:bg-secondary/50"
                >
                  <TableCell className="p-1">
                    <div className="relative">
                      <Input
                        value={row.code}
                        onChange={(e) =>
                          updateRow(row.id, "code", e.target.value)
                        }
                        placeholder="600519"
                        className="h-8 bg-secondary text-foreground border-border text-xs font-mono px-2"
                        maxLength={6}
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
                      value={row.name}
                      onChange={(e) =>
                        updateRow(row.id, "name", e.target.value)
                      }
                      placeholder="贵州茅台"
                      className="h-8 bg-secondary text-foreground border-border text-xs px-2"
                      title={row.name ? `股票名称: ${row.name}` : "请输入股票名称或通过代码自动获取"}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      value={row.sector}
                      onChange={(e) =>
                        updateRow(row.id, "sector", e.target.value)
                      }
                      placeholder="白酒、消费"
                      list={existingSectors.length > 0 ? `sector-datalist-${row.id}` : undefined}
                      className="h-8 bg-secondary text-foreground border-border text-xs px-2"
                      title={row.sector ? `板块: ${row.sector}` : "请输入板块（多个用、分隔），可从历史选项选择"}
                    />
                    {existingSectors.length > 0 && (
                      <datalist id={`sector-datalist-${row.id}`}>
                        {existingSectors.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    )}
                  </TableCell>
                  <TableCell className="p-1">
                    <Select
                      value={row.sector_pattern}
                      onValueChange={(val) =>
                        updateRow(row.id, "sector_pattern", val)
                      }
                    >
                      <SelectTrigger className="h-8 bg-secondary text-foreground border-border text-xs px-2 [&>span]:truncate">
                        <SelectValue placeholder="选择形态" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground">
                        <SelectItem
                          value="none"
                          className="text-xs text-muted-foreground focus:bg-secondary focus:text-foreground"
                        >
                          无
                        </SelectItem>
                        <SelectItem
                          value="水下拉水上"
                          className="text-xs text-foreground focus:bg-secondary focus:text-foreground"
                        >
                          水下拉水上
                        </SelectItem>
                        <SelectItem
                          value="波动三角收窄"
                          className="text-xs text-foreground focus:bg-secondary focus:text-foreground"
                        >
                          波动三角收窄
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.turnover}
                      onChange={(e) => {
                        const val = e.target.value;
                        // 数据类型检测：只允许数字和小数点
                        if (val === "" || /^\d*\.?\d*$/.test(val)) {
                          updateRow(row.id, "turnover", val);
                        }
                      }}
                      placeholder="3.2"
                      className="h-8 bg-secondary text-foreground border-border text-xs font-mono px-2"
                      title={row.turnover ? `换手率: ${row.turnover}%` : "请输入换手率或通过代码自动获取"}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.chg}
                      onChange={(e) => {
                        const val = e.target.value;
                        // 数据类型检测：只允许数字和小数点
                        if (val === "" || /^-?\d*\.?\d*$/.test(val)) {
                          updateRow(row.id, "chg", val);
                        }
                      }}
                      placeholder="2.5"
                      className="h-8 bg-secondary text-foreground border-border text-xs font-mono px-2"
                      title={row.chg ? `涨跌幅: ${row.chg}%` : "请输入涨跌幅或通过代码自动获取"}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        // 数据类型检测：只允许数字和小数点
                        if (val === "" || /^\d*\.?\d*$/.test(val)) {
                          updateRow(row.id, "amount", val);
                        }
                      }}
                      placeholder="85"
                      className="h-8 bg-secondary text-foreground border-border text-xs font-mono px-2"
                      title={row.amount ? `市值: ${row.amount} 亿` : "请输入市值或通过代码自动获取"}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.debt_ratio}
                      onChange={(e) => {
                        const val = e.target.value;
                        // 数据类型检测：只允许数字和小数点，范围 0-100
                        if (val === "" || /^\d*\.?\d*$/.test(val)) {
                          const num = parseFloat(val);
                          if (val === "" || (!isNaN(num) && num >= 0 && num <= 100)) {
                            updateRow(row.id, "debt_ratio", val);
                          }
                        }
                      }}
                      placeholder="45.2"
                      className="h-8 bg-secondary text-foreground border-border text-xs font-mono px-2"
                      title={row.debt_ratio ? `资产负债率: ${row.debt_ratio}%` : "请输入资产负债率（0-100%）"}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length <= 1}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label={`删除第${idx + 1}行`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
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
            <Button
              variant="outline"
              size="sm"
              onClick={addRow}
              className="text-foreground border-border hover:bg-secondary bg-transparent"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1"
              >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              添加行
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addSampleData}
              className="text-muted-foreground border-border hover:bg-secondary hover:text-foreground bg-transparent"
            >
              填入示例
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              className="text-muted-foreground border-border hover:bg-secondary hover:text-foreground bg-transparent"
            >
              清空表格
            </Button>
          </div>
          <Button
            onClick={handleSubmit}
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-8"
          >
            录入
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
        填写代码和名称即可录入。板块用顿号或逗号分隔多个。板块分时可选「水下拉水上」或「波动三角收窄」。
        </p>
    </div>
  );
}
