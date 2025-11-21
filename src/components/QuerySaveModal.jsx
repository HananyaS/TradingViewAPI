import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Modal from './common/Modal';
import Button from './common/Button';

const QuerySaveModal = ({ onSave, onClose }) => {
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_favorite: false,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name.trim()) {
      onSave(formData);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Save Strategy"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Strategy Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., High Volume Breakouts"
            required
            autoFocus
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              theme === 'dark'
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description (optional)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe what this strategy searches for..."
            rows={3}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              theme === 'dark'
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="is_favorite"
            checked={formData.is_favorite}
            onChange={(e) => setFormData({ ...formData, is_favorite: e.target.checked })}
            className="h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="is_favorite" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
            Add to favorites
          </label>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
          >
            Save Strategy
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default QuerySaveModal;

