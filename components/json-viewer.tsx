"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SignalRecord } from "@/lib/types";

interface JsonViewerProps {
  records: SignalRecord[];
}

export function JsonViewer({ records }: JsonViewerProps) {
  const [expanded, setExpanded] = useState(false);

  if (records.length === 0) return null;

  const json = JSON.stringify(records, null, 2);
  const preview = json.slice(0, 500);

  function handleCopy() {
    navigator.clipboard.writeText(json);
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg font-semibold text-foreground">
          <span>标准化 JSON</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="text-xs border-border text-muted-foreground hover:text-foreground bg-transparent"
            >
              复制
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-xs border-border text-muted-foreground hover:text-foreground"
            >
              {expanded ? "收起" : "展开"}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="rounded-md bg-secondary p-4 text-xs font-mono text-foreground overflow-x-auto max-h-[400px] overflow-y-auto leading-relaxed">
          {expanded ? json : `${preview}${json.length > 500 ? "\n..." : ""}`}
        </pre>
      </CardContent>
    </Card>
  );
}
