import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import TopNav from '../components/TopNav';
import FilterBuilder from '../components/FilterBuilder';
import ResultsTable from '../components/ResultsTable';
import SavedQueries from '../components/SavedQueries';
import QuerySaveModal from '../components/QuerySaveModal';
import QueryLoadModal from '../components/QueryLoadModal';
import { toast } from 'react-hot-toast';

const Dashboard = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [filters, setFilters] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savedQueries, setSavedQueries] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showSavedQueries, setShowSavedQueries] = useState(false);

  useEffect(() => {
    loadSavedQueries();
  }, []);

  const loadSavedQueries = async () => {
    try {
      const response = await fetch('/api/query/list', {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setSavedQueries(data.queries);
      }
    } catch (error) {
      console.error('Error loading saved queries:', error);
    }
  };

  const runScreener = async () => {
    if (!filters.length) {
      toast.error('Please add at least one filter');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/screener', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          filter_groups: filters,
          columns: null,
          limit: null,
          sort_by: 'market_cap_basic',
          sort_ascending: false
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setResults(data.results || []);
        toast.success(`Found ${data.count} results`);
      } else {
        toast.error(data.message || 'Screening failed');
        setResults([]);
      }
    } catch (error) {
      console.error('Screening error:', error);
      toast.error('Error running screener');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const saveQuery = async (queryData) => {
    try {
      const response = await fetch('/api/query/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...queryData,
          filters: { filter_groups: filters }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Query saved successfully');
        loadSavedQueries();
        setShowSaveModal(false);
      } else {
        toast.error(data.message || 'Failed to save query');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Error saving query');
    }
  };

  const loadQuery = async (queryId) => {
    try {
      const response = await fetch(`/api/query/load/${queryId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success && data.query.filters) {
        setFilters(data.query.filters.filter_groups || []);
        toast.success(`Loaded "${data.query.name}"`);
        setShowLoadModal(false);
      } else {
        toast.error('Failed to load query');
      }
    } catch (error) {
      console.error('Load error:', error);
      toast.error('Error loading query');
    }
  };

  const deleteQuery = async (queryId) => {
    try {
      const response = await fetch(`/api/query/delete/${queryId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('Query deleted');
        loadSavedQueries();
      } else {
        toast.error('Failed to delete query');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Error deleting query');
    }
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <TopNav />
      
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Stock Screener Dashboard
          </h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Build custom filters and discover investment opportunities
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Saved Queries */}
          <div className="lg:col-span-1">
            <SavedQueries
              queries={savedQueries}
              onLoad={loadQuery}
              onDelete={deleteQuery}
              onToggleFavorite={(queryId, isFavorite) => {
                // TODO: Implement toggle favorite
              }}
              onShowAll={() => setShowLoadModal(true)}
            />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Filter Builder */}
            <div className={`rounded-lg shadow-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Filter Builder
                </h2>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowLoadModal(true)}
                    className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors duration-200"
                  >
                    📁 Load Query
                  </button>
                  <button
                    onClick={() => setShowSaveModal(true)}
                    disabled={!filters.length}
                    className="px-4 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    💾 Save Query
                  </button>
                  <button
                    onClick={runScreener}
                    disabled={loading || !filters.length}
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Running...
                      </>
                    ) : (
                      '🚀 Run Screener'
                    )}
                  </button>
                </div>
              </div>
              
              <FilterBuilder
                filters={filters}
                onChange={setFilters}
                theme={theme}
              />
            </div>

            {/* Results Table */}
            {(results.length > 0 || loading) && (
              <div className={`rounded-lg shadow-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6`}>
                <h2 className={`text-xl font-semibold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Screening Results
                  {results.length > 0 && (
                    <span className={`ml-2 text-sm font-normal ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      ({results.length} stocks found)
                    </span>
                  )}
                </h2>
                
                <ResultsTable
                  data={results}
                  loading={loading}
                  theme={theme}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showSaveModal && (
        <QuerySaveModal
          onSave={saveQuery}
          onClose={() => setShowSaveModal(false)}
          theme={theme}
        />
      )}

      {showLoadModal && (
        <QueryLoadModal
          queries={savedQueries}
          onLoad={loadQuery}
          onClose={() => setShowLoadModal(false)}
          theme={theme}
        />
      )}
    </div>
  );
};

export default Dashboard;
