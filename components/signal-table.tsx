"use client";

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
import type { SignalRecord } from "@/lib/types";

interface SignalTableProps {
  records: SignalRecord[];
  title?: string;
  maxRows?: number;
}

export function SignalTable({
  records,
  title = "信号股排名",
  maxRows,
}: SignalTableProps) {
  const display = maxRows ? records.slice(0, maxRows) : records;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground">
          {title}
          {maxRows && records.length > maxRows && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              (显示前 {maxRows} / 共 {records.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground w-10">#</TableHead>
                <TableHead className="text-muted-foreground">代码</TableHead>
                <TableHead className="text-muted-foreground">名称</TableHead>
                <TableHead className="text-muted-foreground">板块</TableHead>
                <TableHead className="text-muted-foreground text-center">
                  板块分时
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {display.map((r, i) => (
                <TableRow
                  key={`${r.code}-${r.date}-${i}`}
                  className="border-border hover:bg-secondary/50"
                >
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {i + 1}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-foreground">
                    {r.code}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {r.name}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.sector.map((s) => (
                        <Badge
                          key={s}
                          className="text-sm font-semibold bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30"
                        >
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {r.sector_pattern ? (
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          r.sector_pattern === "水下拉水上"
                            ? "border-stock-up/50 text-stock-up"
                            : "border-primary/50 text-primary"
                        }`}
                      >
                        {r.sector_pattern}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
