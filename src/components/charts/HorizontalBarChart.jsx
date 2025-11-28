import React, { useState } from 'react';

const HorizontalBarChart = ({
  data = [],
  height = 300,
  barColor = '#2563eb',
  showValues = true
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
    const label = item.label || item.symbol || '';
    return { label, value };
  };

  return (
    <div className="w-full relative">
      <div className="space-y-2">
        {data.map((item, index) => {
          const value = item.count || item.value || 0;
          const label = item.label || item.symbol || '';
          const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const isHovered = hoveredIndex === index;

          return (
            <div key={index} className="relative">
              <div className="flex items-center gap-3">
                <div className="w-20 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                  {label}
                </div>
                <div className="flex-1 relative h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${
                      isHovered ? 'opacity-100' : 'opacity-90'
                    }`}
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: barColor
                    }}
                    onMouseEnter={(e) => handleMouseEnter(index, e)}
                    onMouseLeave={handleMouseLeave}
                  />
                  {showValues && (
                    <div className="absolute inset-0 flex items-center justify-end pr-2">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {value.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
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
          <div className="text-gray-300 mt-0.5">
            Allocation: {getTooltipContent(hoveredIndex).value.toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
};

export default HorizontalBarChart;

