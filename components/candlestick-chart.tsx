"use client";

export interface OhlcPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface CandlestickChartProps {
  data: OhlcPoint[];
  ma20?: number | null;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * 简易蜡烛图（SVG），用于表格内展示近30日 OHLC，可选叠加 MA20 线
 */
export function CandlestickChart({
  data,
  ma20 = null,
  width = 200,
  height = 56,
  className = "",
}: CandlestickChartProps) {
  if (!data || data.length === 0) return null;

  const padding = { top: 4, right: 4, bottom: 4, left: 28 };
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

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* MA20 线（仅最后一个点，水平延伸一截） */}
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
      {/* 蜡烛 */}
      {data.map((d, i) => {
        const x = padding.left + (i + 0.5) * gap;
        const isUp = d.close >= d.open;
        const top = Math.min(scale(d.open), scale(d.close));
        const bodyH = Math.abs(scale(d.close) - scale(d.open)) || 1;
        const bodyY = Math.min(scale(d.open), scale(d.close));
        return (
          <g key={d.date}>
            {/* 影线 */}
            <line
              x1={x}
              y1={scale(d.high)}
              x2={x}
              y2={scale(d.low)}
              stroke={isUp ? "hsl(var(--stock-up))" : "hsl(var(--stock-down))"}
              strokeWidth={strokeW}
            />
            {/* 实体 */}
            <rect
              x={x - candleW / 2}
              y={bodyY}
              width={candleW}
              height={bodyH}
              fill={isUp ? "hsl(var(--stock-up) / 0.4)" : "hsl(var(--stock-down) / 0.4)"}
              stroke={isUp ? "hsl(var(--stock-up))" : "hsl(var(--stock-down))"}
              strokeWidth={strokeW}
            />
          </g>
        );
      })}
    </svg>
  );
}
