import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import FilterBuilder from '../components/FilterBuilder';
import ResultsTable from '../components/ResultsTable';
import SavedQueries from '../components/SavedQueries';
import QuerySaveModal from '../components/QuerySaveModal';
import QueryLoadModal from '../components/QueryLoadModal';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '../utils/api';
import {
  RocketLaunchIcon,
  FolderOpenIcon,
  BookmarkIcon,
  SparklesIcon,
  AdjustmentsHorizontalIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

const Home = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [filters, setFilters] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savedQueries, setSavedQueries] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  
  // Load saved queries on mount
  useEffect(() => {
    loadSavedQueries();
  }, []);
  
  const normalizeQueries = (queries = []) =>
    queries.map((query) => ({
      id: query.id || query._id,
      name: query.name,
      description: query.description,
      is_favorite: query.is_favorite,
      created_at: query.created_at || new Date().toISOString()
    }));

  const loadSavedQueries = async () => {
    try {
      const response = await fetchWithAuth('/api/query/list');
      const data = await response.json();
      
      if (data.success) {
        setSavedQueries(normalizeQueries(data.queries));
      }
    } catch (error) {
      console.error('Error loading saved queries:', error);
    }
  };

  const runScreener = async () => {
    if (!filters.length) {
      toast.error('Please add at least one strategy rule');
      return;
    }

    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/screener', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
        setResults(data.data || []);
        toast.success(`Found ${data.count || data.data?.length || 0} results`);
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
      const response = await fetchWithAuth('/api/query/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...queryData,
          filters: { filter_groups: filters }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Strategy saved successfully');
        loadSavedQueries();
        setShowSaveModal(false);
      } else {
        toast.error(data.message || 'Failed to save strategy');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Error saving strategy');
    }
  };

  const loadQuery = async (queryId) => {
    try {
      const response = await fetchWithAuth(`/api/query/load/${queryId}`);
      const data = await response.json();
      
      if (data.success && data.query.filters) {
        setFilters(data.query.filters.filter_groups || []);
        toast.success(`Loaded "${data.query.name}"`);
        setShowLoadModal(false);
      } else {
        toast.error('Failed to load strategy');
      }
    } catch (error) {
      console.error('Load error:', error);
      toast.error('Error loading strategy');
    }
  };

  const deleteQuery = async (queryId) => {
    try {
      const response = await fetchWithAuth(`/api/query/delete/${queryId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('Strategy deleted');
        loadSavedQueries();
      } else {
        toast.error('Failed to delete strategy');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Error deleting strategy');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Enhanced Hero Section with Glassmorphism */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 lg:p-10 text-white shadow-2xl">
        {/* Animated Background Blobs */}
        <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-white opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-56 sm:w-80 h-56 sm:h-80 bg-white opacity-10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 animation-delay-400"></div>
        
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-6">
            <div className="flex-1 w-full lg:w-auto">
              <div className="flex flex-col sm:flex-row items-start sm:items-center mb-3 sm:mb-4">
                <div className="bg-white/20 backdrop-blur-sm p-2 sm:p-3 rounded-xl sm:rounded-2xl mr-3 sm:mr-4 mb-3 sm:mb-0">
                  <SparklesIcon className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-1 tracking-tight">
                    Advanced Stock Screener
                  </h1>
                  <p className="text-blue-100 text-sm sm:text-base md:text-lg font-medium">
                    Discover high-potential investment opportunities
                  </p>
                </div>
              </div>
              <p className="text-white/90 max-w-2xl leading-relaxed text-sm sm:text-base">
                Build sophisticated filters with real-time market data. Save your strategies, track performance, and make data-driven decisions.
              </p>
            </div>
            
            {/* User Welcome Card */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl w-full lg:w-auto">
              <p className="text-xs sm:text-sm text-blue-100 mb-1">Welcome back,</p>
              <p className="text-xl sm:text-2xl font-bold mb-3">{user?.name?.split(' ')[0] || 'Trader'}</p>
              <div className="flex items-center space-x-4 text-sm">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold">{savedQueries.length}</div>
                  <div className="text-xs text-blue-100">Saved Strategies</div>
                </div>
                <div className="h-8 w-px bg-white/30"></div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold">{results.length}</div>
                  <div className="text-xs text-blue-100">Results Found</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        {[
          { label: 'Active Strategies', value: filters.length, Icon: AdjustmentsHorizontalIcon, color: 'from-blue-500 to-cyan-500' },
          { label: 'Results Found', value: results.length, Icon: ChartBarIcon, color: 'from-purple-500 to-pink-500' },
          { label: 'Saved Strategies', value: savedQueries.length, Icon: BookmarkIcon, color: 'from-green-500 to-emerald-500' },
          { label: 'Total Runs', value: results.length ? 'Live' : 'Idle', Icon: RocketLaunchIcon, color: 'from-slate-500 to-gray-700' }
        ].map((stat, idx) => (
          <Card key={idx} hover className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-0 shadow-lg animate-slide-up" style={{ animationDelay: `${idx * 100}ms` }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              </div>
              <div className={`text-4xl bg-gradient-to-br ${stat.color} p-3 rounded-2xl shadow-lg`}>
                <stat.Icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Sidebar - Saved Queries */}
        <div className="lg:col-span-1 order-2 lg:order-1">
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
          <div className="lg:col-span-3 space-y-4 sm:space-y-6 order-1 lg:order-2">
            {/* Enhanced Strategy Builder Card with Premium Design */}
            <Card className="border-2 border-transparent bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-gray-800 dark:via-gray-800 dark:to-gray-900 shadow-xl">
              {/* Premium Header with Gradient Border */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-10 rounded-t-lg h-1"></div>
                <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-gradient-to-r from-blue-200 to-purple-200 dark:from-blue-900/30 dark:to-purple-900/30">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl blur-lg opacity-50"></div>
                      <div className="relative bg-gradient-to-br from-blue-600 to-purple-600 p-3 rounded-xl shadow-lg">
                        <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                        Strategy Builder
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {filters.length === 0 
                          ? 'Create your first strategy to get started' 
                          : `${filters.length} active strateg${filters.length !== 1 ? 'ies' : 'y'} configured`
                        }
                      </p>
                    </div>
                  </div>
                  
                  {/* Action Buttons with Enhanced Design */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                    <Button
                      onClick={() => setShowLoadModal(true)}
                      variant="outline"
                      size="md"
                      className="border-2 hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-400 transition-all duration-200 text-sm sm:text-base"
                      icon={<FolderOpenIcon className="h-4 w-4 sm:h-5 sm:w-5" />}
                    >
                      <span className="hidden sm:inline">Load</span>
                      <span className="sm:hidden">Load Strategy</span>
                    </Button>
                    <Button
                      onClick={() => setShowSaveModal(true)}
                      disabled={!filters.length}
                      variant="secondary"
                      size="md"
                      className="shadow-lg hover:shadow-xl transition-all duration-200 text-sm sm:text-base"
                      icon={<BookmarkIcon className="h-4 w-4 sm:h-5 sm:w-5" />}
                    >
                      Save
                    </Button>
                    <Button
                      onClick={runScreener}
                      disabled={loading || !filters.length}
                      loading={loading}
                      variant="primary"
                      size="md"
                      className="shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-200 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-sm sm:text-base"
                      icon={!loading && <RocketLaunchIcon className="h-4 w-4 sm:h-5 sm:w-5" />}
                    >
                      {loading ? 'Analyzing...' : 'Run Screener'}
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Strategy Builder Component */}
              <div className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-xl p-3 sm:p-4 md:p-6 border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                <FilterBuilder
                  filters={filters}
                  onChange={setFilters}
                  theme={theme}
                />
              </div>
            </Card>

          {/* Enhanced Results Table Card */}
          {(results.length > 0 || loading) && (
            <Card className="animate-slide-in border-2 border-transparent bg-gradient-to-br from-white via-green-50/20 to-emerald-50/20 dark:from-gray-800 dark:via-gray-800 dark:to-gray-900 shadow-2xl">
              {/* Premium Results Header */}
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 opacity-10 rounded-t-lg h-1"></div>
                <div className="flex items-center justify-between pb-6 border-b-2 border-gradient-to-r from-green-200 to-emerald-200 dark:from-green-900/30 dark:to-emerald-900/30">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl blur-lg opacity-50"></div>
                      <div className="relative bg-gradient-to-br from-green-600 to-emerald-600 p-3 rounded-xl shadow-lg">
                        <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400">
                        Screening Results
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Real-time market data analysis
                      </p>
                    </div>
                  </div>
                  {results.length > 0 && (
                    <div className="flex items-center space-x-3">
                      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg">
                        <div className="text-3xl font-bold">{results.length}</div>
                        <div className="text-xs opacity-90">Stocks Found</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Results Table with Enhanced Container */}
              <div className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
                <ResultsTable
                  data={results}
                  loading={loading}
                  theme={theme}
                />
              </div>
            </Card>
          )}
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

export default Home;

