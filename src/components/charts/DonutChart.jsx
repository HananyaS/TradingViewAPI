import React, { useState } from 'react';

const COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#0ea5e9',
  '#f97316',
  '#22c55e',
  '#eab308',
  '#14b8a6'
];

const DonutChart = ({ data = [], size = 220, strokeWidth = 18 }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const validData = data.filter((item) => item && item.value > 0);
  const total = validData.reduce((sum, item) => sum + item.value, 0);

  if (!total) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-500 dark:text-gray-400">
        No open positions to show
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const handleMouseEnter = (index, event) => {
    setHoveredIndex(index);
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const getTooltipContent = (index) => {
    const slice = validData[index];
    return {
      symbol: slice.symbol || slice.label || '',
      value: slice.value || 0,
      percent: slice.percent || slice.percentage || 0
    };
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 items-center xl:items-start w-full relative">
      <div className="shrink-0 relative" style={{ position: 'relative' }}>
        <svg width={size} height={size} role="img" aria-label="Asset allocation">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(148, 163, 184, 0.2)"
            strokeWidth={strokeWidth}
          />
          {validData.map((slice, index) => {
            const value = (slice.value / total) * circumference;
            const isHovered = hoveredIndex === index;
            const circle = (
              <circle
                key={slice.symbol}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth}
                strokeDasharray={`${value} ${circumference}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                opacity={isHovered ? 1 : hoveredIndex !== null ? 0.5 : 1}
                onMouseEnter={(e) => handleMouseEnter(index, e)}
                onMouseLeave={handleMouseLeave}
                style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              />
            );
            offset += value;
            return circle;
          })}
        </g>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          className="text-xl font-semibold fill-gray-800 dark:fill-white"
          dy="0.35em"
        >
          {Math.round(total).toLocaleString()}
        </text>
        </svg>
      </div>
      {hoveredIndex !== null && (
        <div
          className="absolute z-50 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none border border-gray-700"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translate(-50%, -100%)',
            marginTop: '-8px',
            whiteSpace: 'nowrap'
          }}
        >
          <div className="font-semibold mb-1">{getTooltipContent(hoveredIndex).symbol}</div>
          <div className="text-gray-300">
            Value: ${getTooltipContent(hoveredIndex).value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-gray-300">
            {getTooltipContent(hoveredIndex).percent.toFixed(2)}%
          </div>
        </div>
      )}
      <div className="flex-1 w-full space-y-3">
        {validData.map((slice, index) => (
          <div 
            key={slice.symbol} 
            className="flex items-center justify-between text-sm"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{ cursor: 'pointer' }}
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              ></span>
              <span className="font-medium text-gray-900 dark:text-white">{slice.symbol || slice.label}</span>
            </div>
            <div className="text-right text-gray-600 dark:text-gray-300">
              <p className="font-semibold">{slice.percent?.toFixed(1)}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">${slice.value?.toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DonutChart;

