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
      <div className="h-48 flex items-center justify-center text-xs text-[#54625A] dark:text-[#C5D4C9]">
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
      <div className="flex flex-wrap items-center justify-between text-xs text-[#54625A] dark:text-[#C5D4C9] pb-1 border-b border-[#EAE5D9] dark:border-[#283931]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#173D32] dark:bg-[#4F9B8B] shadow-xs" />
            <span className="text-[#202522] dark:text-[#F5F2EA] font-medium">Grievances Lodged</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#1E6B52] dark:bg-[#78C7AE] shadow-xs" />
            <span className="text-[#202522] dark:text-[#F5F2EA] font-medium">Official Resolutions</span>
          </div>
        </div>

        {hoverIndex !== null && data[hoverIndex] && (
          <div className="text-[11px] font-mono text-[#202522] dark:text-[#F5F2EA] bg-[#FAF8F5] dark:bg-[#16201C] px-2 py-0.5 rounded border border-[#DED8CB] dark:border-[#283931]">
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
              <stop offset="0%" stopColor="#173D32" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#173D32" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1E6B52" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#1E6B52" stopOpacity="0.0" />
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
                  stroke="#DED8CB"
                  className="stroke-[#DED8CB] dark:stroke-[#283931]"
                  strokeDasharray="3 3"
                  strokeWidth="0.8"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-[#54625A] dark:fill-[#C5D4C9] text-[10px] font-mono"
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
            stroke="#173D32"
            className="stroke-[#173D32] dark:stroke-[#4F9B8B]"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={resolvedPoints}
            fill="none"
            stroke="#1E6B52"
            className="stroke-[#1E6B52] dark:stroke-[#78C7AE]"
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
                fill="#173D32"
                stroke="#FFFFFF"
                className="fill-[#173D32] dark:fill-[#4F9B8B] stroke-white dark:stroke-[#16201C]"
                strokeWidth="2"
              />
              <circle
                cx={getX(i)}
                cy={getY(d.resolved)}
                r={hoverIndex === i ? 5 : 3}
                fill="#1E6B52"
                stroke="#FFFFFF"
                className="fill-[#1E6B52] dark:fill-[#78C7AE] stroke-white dark:stroke-[#16201C]"
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
                className="fill-[#54625A] dark:fill-[#C5D4C9] text-[10px] font-medium"
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
      <div className="h-48 flex items-center justify-center text-xs text-[#54625A] dark:text-[#C5D4C9]">
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
          <span className="text-2xl font-bold font-mono text-[#202522] dark:text-[#F5F2EA] leading-none">
            {hoverIndex !== null ? slices[hoverIndex].value : total}
          </span>
          <span className="text-[11px] font-medium text-[#54625A] dark:text-[#C5D4C9] mt-0.5 truncate max-w-[90px]">
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
                isHovered ? 'bg-[#ECE7DB] dark:bg-[#1C2823]' : 'hover:bg-[#FAF8F5] dark:hover:bg-[#141C18]'
              }`}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="text-[#202522] dark:text-[#F5F2EA] font-medium truncate">{slice.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                <span className="text-[#202522] dark:text-[#F5F2EA] font-semibold">{slice.value}</span>
                <span className="text-[#54625A] dark:text-[#C5D4C9] w-10 text-right">{percent}%</span>
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
      <div className="h-32 flex items-center justify-center text-xs text-[#54625A] dark:text-[#C5D4C9]">
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
              <span className="font-medium text-[#202522] dark:text-[#F5F2EA] truncate pr-2">{item.label}</span>
              <span className="font-mono font-semibold text-[#202522] dark:text-[#F5F2EA] shrink-0">
                {item.value} {valueSuffix}
              </span>
            </div>

            <div className="h-2 w-full bg-[#ECE7DB] dark:bg-[#1C2823] rounded-full overflow-hidden border border-[#DED8CB] dark:border-[#283931]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${percent}%`,
                  backgroundColor: item.colorHex || '#173D32',
                }}
              />
            </div>

            {item.subLabel && <p className="text-[11px] text-[#54625A] dark:text-[#C5D4C9]">{item.subLabel}</p>}
          </div>
        );
      })}
    </div>
  );
}
