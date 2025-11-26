import React from 'react';

const MiniAreaChart = ({
  data = [],
  height = 160,
  stroke = '#2563eb',
  fill = 'rgba(37, 99, 235, 0.12)'
}) => {
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
    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${height} L ${points[0].x.toFixed(
    2
  )} ${height} Z`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-48"
        role="img"
        aria-label="Portfolio value over time"
      >
        <path d={areaPath} fill={fill} />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round" />
      </svg>
      <div className="flex justify-between text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 px-1">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
};

export default MiniAreaChart;


