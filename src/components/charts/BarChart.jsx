import React, { useState } from 'react';

const BarChart = ({
  data = [],
  height = 200,
  barColor = '#2563eb',
  showLabels = true,
  labelRotation = 0,
  xAxisLabel = '',
  yAxisLabel = ''
}) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-500 dark:text-gray-400">
        Not enough data yet
      </div>
    );
  }

  const values = data.map((item) => item.count || item.value || 0);
  const maxValue = values.length > 0 ? Math.max(...values) : 0;
  const barWidth = data.length > 0 ? Math.max(20, (100 / data.length) - 2) : 0;
  
  // Calculate tick values for Y axis (fewer ticks for cleaner display)
  const numTicks = 4;
  const tickStep = maxValue / (numTicks - 1);
  const ticks = Array.from({ length: numTicks }, (_, i) => i * tickStep);
  
  // Padding for axes and labels (in viewBox units: 0-100 for x, 0-height for y)
  const leftPadding = yAxisLabel ? 10 : 7;
  const rightPadding = 2;
  const topPadding = 2;
  const bottomPadding = xAxisLabel ? 10 : 7;
  
  const chartWidth = 100 - leftPadding - rightPadding;
  const chartHeight = height - topPadding - bottomPadding;
  const chartXStart = leftPadding;
  const chartYStart = topPadding;

  const handleMouseEnter = (index, event) => {
    setHoveredIndex(index);
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const getTooltipContent = (index) => {
    const item = data[index];
    const value = item.count || item.value || 0;
    const label = item.label || item.range || item.time || item.day || item.bucket || '';
    return { label, value };
  };

  return (
    <div className="w-full relative">
      <svg 
        viewBox={`0 0 100 ${height}`} 
        preserveAspectRatio="none" 
        className="w-full" 
        style={{ height: `${height}px` }}
        role="img"
      >
        {/* Y-axis line */}
        <line
          x1={chartXStart}
          y1={chartYStart}
          x2={chartXStart}
          y2={chartYStart + chartHeight}
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-gray-400 dark:text-gray-600"
        />
        
        {/* Y-axis ticks and labels */}
        {ticks.map((tickValue, i) => {
          const tickY = chartYStart + chartHeight - (tickValue / maxValue) * chartHeight;
          return (
            <g key={i}>
              <line
                x1={chartXStart}
                y1={tickY}
                x2={chartXStart - 0.8}
                y2={tickY}
                stroke="currentColor"
                strokeWidth="0.3"
                className="text-gray-400 dark:text-gray-600"
              />
              <text
                x={chartXStart - 1.2}
                y={tickY}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-gray-500 dark:fill-gray-400"
                fontSize="6.5"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                {tickValue.toFixed(maxValue < 10 ? 1 : 0)}
              </text>
            </g>
          );
        })}
        
        {/* Y-axis label */}
        {yAxisLabel && (
          <text
            x={chartXStart / 2}
            y={chartYStart + chartHeight / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(-90 ${chartXStart / 2} ${chartYStart + chartHeight / 2})`}
            className="fill-gray-600 dark:fill-gray-300"
            fontSize="7"
            fontWeight="500"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {yAxisLabel}
          </text>
        )}
        
        {/* X-axis line */}
        <line
          x1={chartXStart}
          y1={chartYStart + chartHeight}
          x2={chartXStart + chartWidth}
          y2={chartYStart + chartHeight}
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-gray-400 dark:text-gray-600"
        />
        
        {/* X-axis ticks */}
        {data.map((item, index) => {
          const x = chartXStart + (index / (data.length - 1 || 1)) * chartWidth;
          return (
            <line
              key={index}
              x1={x}
              y1={chartYStart + chartHeight}
              x2={x}
              y2={chartYStart + chartHeight + 1}
              stroke="currentColor"
              strokeWidth="0.3"
              className="text-gray-400 dark:text-gray-600"
            />
          );
        })}
        
        {/* X-axis label */}
        {xAxisLabel && (
          <text
            x={chartXStart + chartWidth / 2}
            y={chartYStart + chartHeight + 2.2}
            textAnchor="middle"
            dominantBaseline="hanging"
            className="fill-gray-600 dark:fill-gray-300"
            fontSize="7"
            fontWeight="500"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {xAxisLabel}
          </text>
        )}
        
        {/* Bars */}
        {data.map((item, index) => {
          const value = item.count || item.value || 0;
          const barHeight = maxValue > 0 ? (value / maxValue) * chartHeight : 0;
          const x = chartXStart + (index / (data.length - 1 || 1)) * chartWidth;
          const y = chartYStart + chartHeight - barHeight;
          const isHovered = hoveredIndex === index;
          const barW = (chartWidth / data.length) * 0.8;

          return (
            <g key={index}>
              <rect
                x={x - barW / 2}
                y={y}
                width={barW}
                height={barHeight}
                fill={barColor}
                opacity={isHovered ? 1 : 0.8}
                rx={2}
                onMouseEnter={(e) => handleMouseEnter(index, e)}
                onMouseLeave={handleMouseLeave}
                style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              />
            </g>
          );
        })}
      </svg>
      {hoveredIndex !== null && (
        <div
          className="absolute z-50 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translate(-50%, -100%)',
            whiteSpace: 'nowrap'
          }}
        >
          <div className="font-semibold">{getTooltipContent(hoveredIndex).label}</div>
          <div className="text-gray-300 mt-0.5">Value: {getTooltipContent(hoveredIndex).value}</div>
        </div>
      )}
    </div>
  );
};

export default BarChart;

