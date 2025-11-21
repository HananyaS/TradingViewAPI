import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Card from './common/Card';
import Button from './common/Button';
import EmptyState from './common/EmptyState';
import {
  BookmarkIcon,
  TrashIcon,
  StarIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

const SavedQueries = ({ queries = [], onLoad, onDelete, onToggleFavorite, onShowAll }) => {
  const { theme } = useTheme();

  // Show only first 5 queries
  const displayQueries = queries.slice(0, 5);

  if (queries.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <BookmarkIcon className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
          Saved Strategies
        </h3>
        <EmptyState
          icon={BookmarkIcon}
          title="No saved strategies"
          description="Save your strategies for quick access"
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <BookmarkIcon className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
          Saved Strategies
        </h3>
        {queries.length > 5 && (
          <button
            onClick={onShowAll}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            View all ({queries.length})
          </button>
        )}
      </div>

      <div className="space-y-2">
        {displayQueries.map((query) => {
          const createdAt = query.created_at ? new Date(query.created_at) : null;
          return (
            <div
              key={query.id}
              className={`group p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                theme === 'dark'
                  ? 'border-gray-700 hover:bg-gray-700 hover:border-blue-600'
                  : 'border-gray-200 hover:bg-gray-50 hover:border-blue-400'
              }`}
              onClick={() => onLoad(query.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {query.name}
                    </h4>
                    {query.is_favorite && (
                      <StarIconSolid className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                    )}
                  </div>
                  {query.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                      {query.description}
                    </p>
                  )}
                  <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-500">
                    <ClockIcon className="h-3 w-3 mr-1" />
                    {createdAt ? createdAt.toLocaleDateString() : '--'}
                  </div>
                </div>
                
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(query.id, !query.is_favorite);
                    }}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    title={query.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {query.is_favorite ? (
                      <StarIconSolid className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <StarIcon className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Delete this strategy?')) {
                        onDelete(query.id);
                      }
                    }}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20"
                    title="Delete strategy"
                  >
                    <TrashIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {queries.length > 5 && (
        <Button
          onClick={onShowAll}
          variant="ghost"
          className="w-full mt-4"
          size="sm"
        >
          View All Strategies ({queries.length})
        </Button>
      )}
    </Card>
  );
};

export default SavedQueries;

