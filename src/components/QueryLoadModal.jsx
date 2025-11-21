import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Modal from './common/Modal';
import Button from './common/Button';
import EmptyState from './common/EmptyState';
import {
  MagnifyingGlassIcon,
  FolderOpenIcon,
  StarIcon,
  ClockIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

const QueryLoadModal = ({ queries = [], onLoad, onClose, theme: propTheme }) => {
  const { theme } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredQueries = queries.filter(query =>
    query.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    query.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Load Saved Strategy"
      size="lg"
    >
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search strategies..."
            className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              theme === 'dark'
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>

        {/* Queries List */}
        {filteredQueries.length === 0 ? (
          <EmptyState
            icon={FolderOpenIcon}
            title={searchTerm ? 'No strategies found' : 'No saved strategies'}
            description={searchTerm ? 'Try a different search term' : 'Save your first strategy to see it here'}
          />
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-2">
            {filteredQueries.map((query) => (
              <div
                key={query.id}
                className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer ${
                  theme === 'dark'
                    ? 'border-gray-700 hover:bg-gray-700 hover:border-blue-600'
                    : 'border-gray-200 hover:bg-gray-50 hover:border-blue-400'
                }`}
                onClick={() => onLoad(query.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                        {query.name}
                      </h4>
                      {query.is_favorite && (
                        <StarIconSolid className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                      )}
                    </div>
                    {query.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {query.description}
                      </p>
                    )}
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-500">
                      <ClockIcon className="h-3 w-3 mr-1" />
                      Created {new Date(query.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={onClose}
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default QueryLoadModal;

