import React, { useState, useMemo } from 'react';
import { 
  ChevronUpIcon, 
  ChevronDownIcon, 
  MagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon 
} from '@heroicons/react/24/outline';

const ResultsTable = ({ data, loading, theme }) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    
    return data.filter(row =>
      Object.values(row).some(value =>
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data, searchTerm]);

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = aValue.toString().toLowerCase();
      const bStr = bValue.toString().toLowerCase();
      
      if (sortConfig.direction === 'asc') {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      } else {
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
      }
    });
  }, [filteredData, sortConfig]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const formatValue = (key, value) => {
    if (value === null || value === undefined) return '-';

    // Format percentages
    if (key.includes('change') || key.includes('percent') || key.includes('ratio')) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        return (
          <span className={`font-medium ${
            numValue > 0 
              ? 'text-green-600' 
              : numValue < 0 
                ? 'text-red-600' 
                : theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            {numValue > 0 ? '+' : ''}{numValue.toFixed(2)}%
          </span>
        );
      }
    }

    // Format large numbers (market cap, volume)
    if (key.includes('market_cap') || key.includes('volume')) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        if (numValue >= 1e9) {
          return `${(numValue / 1e9).toFixed(1)}B`;
        } else if (numValue >= 1e6) {
          return `${(numValue / 1e6).toFixed(1)}M`;
        } else if (numValue >= 1e3) {
          return `${(numValue / 1e3).toFixed(1)}K`;
        }
      }
    }

    // Format prices
    if (key.includes('price') || key === 'close' || key === 'open' || key === 'high' || key === 'low') {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        return `$${numValue.toFixed(2)}`;
      }
    }

    return value;
  };

  const getColumnDisplayName = (key) => {
    const displayNames = {
      'name': 'Symbol',
      'exchange': 'Exchange',
      'close': 'Price',
      'change': 'Change %',
      'volume': 'Volume',
      'market_cap_basic': 'Market Cap',
      'relative_volume': 'Rel. Volume',
      'SMA20': 'SMA20',
      'RSI': 'RSI',
      'ATR': 'ATR',
      'BB.lower': 'BB Lower',
      'BB.upper': 'BB Upper'
    };
    return displayNames[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Loading skeleton */}
        <div className="animate-pulse">
          <div className={`h-10 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className={`h-12 mt-2 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className={`text-center py-12 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
        <MagnifyingGlassIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No results found. Try adjusting your filters.</p>
      </div>
    );
  }

  const columns = Object.keys(data[0] || {});

  return (
    <div className="space-y-4">
      {/* Search and Info */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search results..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              theme === 'dark' 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>
        
        <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          Showing {paginatedData.length} of {sortedData.length} results
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className={`min-w-full divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
          <thead className={theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}>
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  onClick={() => handleSort(column)}
                  className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 transition-colors duration-200 ${
                    theme === 'dark' 
                      ? 'text-gray-300 hover:bg-gray-700' 
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center space-x-1">
                    <span>{getColumnDisplayName(column)}</span>
                    {sortConfig.key === column && (
                      sortConfig.direction === 'asc' 
                        ? <ChevronUpIcon className="h-4 w-4" />
                        : <ChevronDownIcon className="h-4 w-4" />
                    )}
                  </div>
                </th>
              ))}
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y ${theme === 'dark' ? 'divide-gray-700 bg-gray-800' : 'divide-gray-200 bg-white'}`}>
            {paginatedData.map((row, index) => (
              <tr
                key={index}
                className={`hover:bg-opacity-50 transition-colors duration-200 ${
                  theme === 'dark' 
                    ? 'hover:bg-gray-700' 
                    : 'hover:bg-gray-50'
                }`}
              >
                {columns.map((column) => (
                  <td
                    key={column}
                    className={`px-6 py-4 whitespace-nowrap text-sm ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-900'
                    }`}
                  >
                    {column === 'name' ? (
                      <div className="flex items-center">
                        <span className="font-medium">{row[column]}</span>
                        {row.exchange && (
                          <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                            theme === 'dark' 
                              ? 'bg-gray-700 text-gray-300' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {row.exchange}
                          </span>
                        )}
                      </div>
                    ) : (
                      formatValue(column, row[column])
                    )}
                  </td>
                ))}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => window.open(`https://www.tradingview.com/symbols/${row.name}`, '_blank')}
                    className="text-blue-600 hover:text-blue-900 transition-colors duration-200"
                    title="View on TradingView"
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}>
            Page {currentPage} of {totalPages}
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 text-sm border rounded transition-colors duration-200 ${
                currentPage === 1
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-gray-50'
              } ${
                theme === 'dark' 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Previous
            </button>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 text-sm border rounded transition-colors duration-200 ${
                currentPage === totalPages
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-gray-50'
              } ${
                theme === 'dark' 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsTable;
