import React from 'react';

const EmptyState = ({ 
  icon: Icon, 
  title, 
  description, 
  action,
  className = '' 
}) => {
  return (
    <div className={`text-center py-12 ${className}`}>
      {Icon && (
        <Icon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
      )}
      {title && (
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
      )}
      {description && (
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {description}
        </p>
      )}
      {action}
    </div>
  );
};

export default EmptyState;

