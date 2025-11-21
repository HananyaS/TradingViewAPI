import React from 'react';

const Card = ({ 
  children, 
  className = '', 
  padding = 'p-6',
  hover = false,
  onClick
}) => {
  const baseStyles = 'bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-all duration-200';
  const hoverStyles = hover ? 'hover:shadow-md hover:scale-[1.01] cursor-pointer' : '';
  
  return (
    <div 
      className={`${baseStyles} ${hoverStyles} ${padding} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;

