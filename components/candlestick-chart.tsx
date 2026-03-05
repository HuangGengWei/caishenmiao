"use client";

export interface OhlcPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChartMarker {
  date: string;
  label: string;
}

interface CandlestickChartProps {
  data: OhlcPoint[];
  ma20?: number | null;
  /** 录入日，在图上画竖虚线 */
  recordDate?: string | null;
  /** 涨停日及标签（如 "D+3"），在图上画点与文字 */
  limitUpMarkers?: ChartMarker[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * 简易蜡烛图（SVG），用于表格内展示 OHLC，可选叠加 MA20、录入日竖线、涨停日标注
 */
export function CandlestickChart({
  data,
  ma20 = null,
  recordDate = null,
  limitUpMarkers = [],
  width = 200,
  height = 56,
  className = "",
}: CandlestickChartProps) {
  if (!data || data.length === 0) return null;

  const padding = { top: 12, right: 4, bottom: 4, left: 28 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const lows = data.map((d) => d.low);
  const highs = data.map((d) => d.high);
  const minVal = Math.min(...lows);
  const maxVal = Math.max(...highs);
  const range = maxVal - minVal || 1;
  const scale = (v: number) =>
    padding.top + chartHeight - ((v - minVal) / range) * chartHeight;

  const candleW = Math.max(2, (chartWidth / data.length) * 0.6);
  const gap = chartWidth / data.length;
  const strokeW = 1;

  const dateToIndex = new Map(data.map((d, i) => [d.date, i]));
  const recordIdx = recordDate != null ? dateToIndex.get(recordDate) : undefined;
  const limitUpSet = new Map(limitUpMarkers.map((m) => [m.date, m.label]));

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* MA20 线 */}
      {ma20 != null && (
        <line
          x1={padding.left}
          y1={scale(ma20)}
          x2={padding.left + chartWidth}
          y2={scale(ma20)}
          stroke="hsl(24 90% 50%)"
          strokeWidth={1}
          strokeDasharray="3 2"
          opacity={0.9}
        />
      )}
      {/* 录入日竖线 */}
      {recordIdx != null && recordIdx >= 0 && (
        <line
          x1={padding.left + (recordIdx + 0.5) * gap}
          y1={padding.top}
          x2={padding.left + (recordIdx + 0.5) * gap}
          y2={padding.top + chartHeight}
          stroke="hsl(var(--primary))"
          strokeWidth={1}
          strokeDasharray="2 2"
          opacity={0.9}
        />
      )}
      {/* 蜡烛 */}
      {data.map((d, i) => {
        const x = padding.left + (i + 0.5) * gap;
        const isUp = d.close >= d.open;
        const top = Math.min(scale(d.open), scale(d.close));
        const bodyH = Math.abs(scale(d.close) - scale(d.open)) || 1;
        const bodyY = Math.min(scale(d.open), scale(d.close));
        const strokeColor = isUp
          ? "hsl(var(--stock-down))"
          : "hsl(var(--stock-up))";
        const fillColor = isUp
          ? "hsl(var(--stock-down) / 0.4)"
          : "hsl(var(--stock-up) / 0.4)";
        const limitLabel = limitUpSet.get(d.date);
        return (
          <g key={d.date}>
            {/* 影线 */}
            <line
              x1={x}
              y1={scale(d.high)}
              x2={x}
              y2={scale(d.low)}
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            {/* 实体 */}
            <rect
              x={x - candleW / 2}
              y={bodyY}
              width={candleW}
              height={bodyH}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            {/* 涨停日：圆点 + 标签 */}
            {limitLabel != null && (
              <g>
                <circle
                  cx={x}
                  cy={scale(d.high) - 6}
                  r={4}
                  fill="hsl(var(--stock-up))"
                  stroke="hsl(var(--background))"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={padding.top + 2}
                  textAnchor="middle"
                  fontSize={8}
                  fill="hsl(var(--stock-up))"
                  fontWeight="600"
                >
                  {limitLabel}
                </text>
              </g>
            )}
          </g>
        );
      })}
      {/* 录入日标签（在竖线上方） */}
      {recordIdx != null && recordIdx >= 0 && (
        <text
          x={padding.left + (recordIdx + 0.5) * gap}
          y={padding.top + 2}
          textAnchor="middle"
          fontSize={8}
          fill="hsl(var(--primary))"
          fontWeight="600"
        >
          录入
        </text>
      )}
    </svg>
  );
}
