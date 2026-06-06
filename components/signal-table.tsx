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
                <TableHead className="text-muted-foreground">股票</TableHead>
                <TableHead className="text-muted-foreground">标签</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {display.map((r, i) => (
                <TableRow
                  key={`${r.stock}-${i}`}
                  className="border-border hover:bg-secondary/50"
                >
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {i + 1}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {r.stock}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(r.tags || "").split(/[,，]/).map((t) => {
                        const tag = t.trim();
                        if (!tag) return null;
                        return (
                          <Badge
                            key={tag}
                            className="text-sm font-semibold bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30"
                          >
                            {tag}
                          </Badge>
                        );
                      })}
                    </div>
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