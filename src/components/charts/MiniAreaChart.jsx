import React, { useState } from 'react';

const MiniAreaChart = ({
  data = [],
  height = 160,
  stroke = '#2563eb',
  fill = 'rgba(37, 99, 235, 0.12)',
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

  const width = Math.max(340, data.length * 60);
  const values = data.map((point) => point.value ?? 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = data.map((point, index) => {
    const x = (index / Math.max(data.length - 1, 1)) * width;
    const normalized = (point.value - min) / range;
    const y = height - normalized * height;
    return { x, y, ...point };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${height} L ${points[0].x.toFixed(
    2
  )} ${height} Z`;

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
    const point = data[index];
    return {
      date: point.date || point.label || '',
      value: point.value ?? 0
    };
  };

  return (
    <div className="w-full relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-48"
        role="img"
        aria-label="Portfolio value over time"
      >
        <path d={areaPath} fill={fill} />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round" />
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={hoveredIndex === index ? 6 : 4}
            fill={stroke}
            opacity={hoveredIndex === index ? 1 : 0.7}
            onMouseEnter={(e) => handleMouseEnter(index, e)}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
          />
        ))}
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
          <div className="font-semibold">{getTooltipContent(hoveredIndex).date}</div>
          <div className="text-gray-300 mt-0.5">Value: {getTooltipContent(hoveredIndex).value.toLocaleString()}</div>
        </div>
      )}
      <div className="flex justify-between text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 px-1 mt-1">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
};

export default MiniAreaChart;


