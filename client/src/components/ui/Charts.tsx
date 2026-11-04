import { useState } from 'react';

// ==========================================
// 1. TREND LINE & AREA CHART
// ==========================================
export interface TrendPoint {
  date: string;
  submitted: number;
  resolved: number;
}

export interface TrendAreaChartProps {
  data: TrendPoint[];
  height?: number;
}

export function TrendAreaChart({ data, height = 240 }: TrendAreaChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-xs text-[#6B7280] dark:text-[#D1D5DB]">
        No trend records available for this period.
      </div>
    );
  }

  const svgWidth = 600;
  const svgHeight = height;
  const paddingX = 40;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const maxVal = Math.max(
    5,
    ...data.map((d) => Math.max(d.submitted, d.resolved))
  );

  const getX = (idx: number) => {
    if (data.length <= 1) return paddingX + chartWidth / 2;
    return paddingX + (idx / (data.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    return paddingTop + chartHeight - (val / maxVal) * chartHeight;
  };

  const submittedPoints = data.map((d, i) => `${getX(i)},${getY(d.submitted)}`).join(' ');
  const resolvedPoints = data.map((d, i) => `${getX(i)},${getY(d.resolved)}`).join(' ');

  const submittedArea = `${getX(0)},${paddingTop + chartHeight} ${submittedPoints} ${getX(
    data.length - 1
  )},${paddingTop + chartHeight}`;

  const resolvedArea = `${getX(0)},${paddingTop + chartHeight} ${resolvedPoints} ${getX(
    data.length - 1
  )},${paddingTop + chartHeight}`;

  // Format date label (e.g. "12 Oct")
  const formatDateLabel = (isoDate: string) => {
    try {
      const parts = isoDate.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      }
      return isoDate;
    } catch {
      return isoDate;
    }
  };

  // Sample X axis labels (up to 5 labels)
  const step = Math.max(1, Math.floor(data.length / 5));
  const labelIndices: number[] = [];
  for (let i = 0; i < data.length; i += step) {
    labelIndices.push(i);
  }
  if (!labelIndices.includes(data.length - 1)) {
    labelIndices.push(data.length - 1);
  }

  return (
    <div className="w-full space-y-3 font-sans">
      {/* Chart Legend */}
      <div className="flex flex-wrap items-center justify-between text-xs text-[#6B7280] dark:text-[#D1D5DB] pb-1 border-b border-[#E5E7EB] dark:border-[#374151]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#0B3D2E] dark:bg-[#34D399] shadow-xs" />
            <span className="text-[#111827] dark:text-[#F9FAFB] font-medium">Grievances Lodged</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#0B6640] dark:bg-[#6EE7B7] shadow-xs" />
            <span className="text-[#111827] dark:text-[#F9FAFB] font-medium">Official Resolutions</span>
          </div>
        </div>

        {hoverIndex !== null && data[hoverIndex] && (
          <div className="text-[11px] font-mono text-[#111827] dark:text-[#F9FAFB] bg-[#F9FAFB] dark:bg-[#273548] px-2 py-0.5 rounded border border-[#E5E7EB] dark:border-[#374151]">
            {formatDateLabel(data[hoverIndex].date)}: {data[hoverIndex].submitted} lodged • {data[hoverIndex].resolved} resolved
          </div>
        )}
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible select-none"
          role="img"
          aria-label="Civic complaint lodging versus resolution trend chart"
        >
          <defs>
            <linearGradient id="submittedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--color-chart-brand)' }} stopOpacity="0.2" />
              <stop offset="100%" style={{ stopColor: 'var(--color-chart-brand)' }} stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--color-chart-secondary)' }} stopOpacity="0.2" />
              <stop offset="100%" style={{ stopColor: 'var(--color-chart-secondary)' }} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = paddingTop + chartHeight * (1 - ratio);
            const val = Math.round(maxVal * ratio);
            return (
              <g key={i}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={svgWidth - paddingX}
                  y2={y}
                  stroke="#E5E7EB"
                  className="stroke-[#E5E7EB] dark:stroke-[#374151]"
                  strokeDasharray="3 3"
                  strokeWidth="0.8"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-[#6B7280] dark:fill-[#9CA3AF] text-[10px] font-mono"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area Fills */}
          <polygon points={submittedArea} fill="url(#submittedGrad)" />
          <polygon points={resolvedArea} fill="url(#resolvedGrad)" />

          {/* Polylines */}
          <polyline
            points={submittedPoints}
            fill="none"
            stroke="#0B3D2E"
            className="stroke-[#0B3D2E] dark:stroke-[#34D399]"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={resolvedPoints}
            fill="none"
            stroke="#0B6640"
            className="stroke-[#0B6640] dark:stroke-[#6EE7B7]"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive Data Points */}
          {data.map((d, i) => (
            <g
              key={i}
              className="cursor-pointer"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <circle
                cx={getX(i)}
                cy={getY(d.submitted)}
                r={hoverIndex === i ? 5 : 3}
                fill="#0B3D2E"
                stroke="#FFFFFF"
                className="fill-[#0B3D2E] dark:fill-[#34D399] stroke-white dark:stroke-[#1F2937]"
                strokeWidth="2"
              />
              <circle
                cx={getX(i)}
                cy={getY(d.resolved)}
                r={hoverIndex === i ? 5 : 3}
                fill="#0B6640"
                stroke="#FFFFFF"
                className="fill-[#0B6640] dark:fill-[#6EE7B7] stroke-white dark:stroke-[#1F2937]"
                strokeWidth="2"
              />
            </g>
          ))}

          {/* X Axis Labels */}
          {labelIndices.map((idx) => {
            const d = data[idx];
            if (!d) return null;
            return (
              <text
                key={idx}
                x={getX(idx)}
                y={svgHeight - 12}
                textAnchor="middle"
                className="fill-[#6B7280] dark:fill-[#9CA3AF] text-[10px] font-medium"
              >
                {formatDateLabel(d.date)}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ==========================================
// 2. DONUT / BREAKDOWN CHART
// ==========================================
export interface DonutSlice {
  label: string;
  value: number;
  color: string;
  textColor?: string;
}

export interface DonutChartProps {
  slices: DonutSlice[];
  centerLabel?: string;
}

export function DonutChart({ slices, centerLabel = 'Total' }: DonutChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const total = slices.reduce((acc, curr) => acc + curr.value, 0);

  if (total === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-xs text-[#6B7280] dark:text-[#D1D5DB]">
        No distribution records logged.
      </div>
    );
  }

  const radius = 64;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;

  const computedSlices = slices.reduce<
    Array<
      DonutSlice & {
        percent: number;
        dashArray: string;
        dashOffset: number;
      }
    >
  >((acc, slice) => {
    const prevAccumulated = acc.reduce((sum, item) => sum + item.percent, 0);
    const percent = slice.value / total;
    acc.push({
      ...slice,
      percent,
      dashArray: `${percent * circumference} ${circumference}`,
      dashOffset: -prevAccumulated * circumference,
    });
    return acc;
  }, []);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2 font-sans">
      {/* SVG Donut */}
      <div className="relative w-44 h-44 shrink-0">
        <svg
          viewBox="0 0 160 160"
          className="w-full h-full -rotate-90 transform overflow-visible"
          role="img"
          aria-label="Distribution donut chart"
        >
          {computedSlices.map((slice, i) => {
            const isHovered = hoverIndex === i;

            return (
              <circle
                key={i}
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={slice.dashArray}
                strokeDashoffset={slice.dashOffset}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            );
          })}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-2xl font-bold font-mono text-[#111827] dark:text-[#F9FAFB] leading-none">
            {hoverIndex !== null ? slices[hoverIndex].value : total}
          </span>
          <span className="text-[11px] font-medium text-[#6B7280] dark:text-[#D1D5DB] mt-0.5 truncate max-w-[90px]">
            {hoverIndex !== null ? slices[hoverIndex].label : centerLabel}
          </span>
        </div>
      </div>

      {/* Legend list */}
      <div className="space-y-2 flex-1 w-full max-w-xs text-xs">
        {slices.map((slice, i) => {
          const percent = total > 0 ? ((slice.value / total) * 100).toFixed(1) : '0';
          const isHovered = hoverIndex === i;

          return (
            <div
              key={i}
              className={`flex items-center justify-between p-1.5 rounded-lg transition-colors cursor-pointer ${
                isHovered ? 'bg-[#F3F4F6] dark:bg-[#273548]' : 'hover:bg-[#F9FAFB] dark:hover:bg-[#273548]/60'
              }`}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="text-[#111827] dark:text-[#F9FAFB] font-medium truncate">{slice.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                <span className="text-[#111827] dark:text-[#F9FAFB] font-semibold">{slice.value}</span>
                <span className="text-[#6B7280] dark:text-[#9CA3AF] w-10 text-right">{percent}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// 3. HORIZONTAL PROGRESS BAR LIST
// ==========================================
export interface BarListItem {
  label: string;
  value: number;
  subLabel?: string;
  colorHex?: string;
}

export interface HorizontalBarChartProps {
  items: BarListItem[];
  valueSuffix?: string;
}

export function HorizontalBarChart({ items, valueSuffix = '' }: HorizontalBarChartProps) {
  const maxVal = Math.max(1, ...items.map((it) => it.value));

  if (!items || items.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-[#6B7280] dark:text-[#D1D5DB]">
        No comparative breakdown logged.
      </div>
    );
  }

  return (
    <div className="space-y-3 font-sans">
      {items.map((item, idx) => {
        const percent = Math.min(100, Math.round((item.value / maxVal) * 100));
        return (
          <div key={idx} className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[#111827] dark:text-[#F9FAFB] truncate pr-2">{item.label}</span>
              <span className="font-mono font-semibold text-[#111827] dark:text-[#F9FAFB] shrink-0">
                {item.value} {valueSuffix}
              </span>
            </div>

            <div className="h-2 w-full bg-[#F3F4F6] dark:bg-[#273548] rounded-full overflow-hidden border border-[#E5E7EB] dark:border-[#374151]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${percent}%`,
                  backgroundColor: item.colorHex || 'var(--color-chart-brand)',
                }}
              />
            </div>

            {item.subLabel && <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">{item.subLabel}</p>}
          </div>
        );
      })}
    </div>
  );
}
