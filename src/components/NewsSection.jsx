import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Card from './common/Card';
import LoadingSpinner from './common/LoadingSpinner';
import { fetchWithAuth } from '../utils/api';
import { toast } from 'react-hot-toast';
import {
  NewspaperIcon,
  ArrowTopRightOnSquareIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const STORY_TYPES = [
  { value: null, label: 'All News', icon: NewspaperIcon },
  { value: 'curated', label: 'Curated', icon: NewspaperIcon },
  { value: 'market', label: 'Market', icon: NewspaperIcon },
  { value: 'sec_fin', label: 'SEC Financial', icon: NewspaperIcon },
  { value: 'trade', label: 'Trading', icon: NewspaperIcon },
  { value: 'analysis', label: 'Analysis', icon: NewspaperIcon }
];

const NewsSection = ({ 
  symbols = [], 
  title = 'Stock News', 
  maxStories = 20,
  showTickerSelection = true,
  showStoryTypes = true,
  autoRefresh = true,
  storyType = null, // If provided, use story type instead of symbols
  preloadedStories = null // If provided, use preloaded stories instead of fetching
}) => {
  const { theme } = useTheme();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [waitTime, setWaitTime] = useState(0);
  const [selectedTickers, setSelectedTickers] = useState(new Set());
  const [activeStoryType, setActiveStoryType] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [cached, setCached] = useState(false);
  
  // Store all preloaded stories in a ref so we can access them even after filtering
  const allPreloadedStoriesRef = useRef(null);

  // Initialize selected tickers to all symbols
  useEffect(() => {
    if (symbols && symbols.length > 0) {
      setSelectedTickers(new Set(symbols));
    }
  }, [symbols]);

  // Use preloaded stories if provided
  useEffect(() => {
    if (preloadedStories) {
      // If preloadedStories is an object with by_ticker, use all_stories
      // Otherwise, use it directly as an array
      const storiesArray = Array.isArray(preloadedStories) 
        ? preloadedStories 
        : (preloadedStories.all_stories || []);
      
      // Store all stories in ref for filtering (so we can filter without losing data)
      allPreloadedStoriesRef.current = storiesArray;
      
      setStories(storiesArray);
      setCached(true);
      setLastFetchTime(Date.now());
      setLoading(false);
    } else {
      allPreloadedStoriesRef.current = null;
    }
  }, [preloadedStories]);

  // Auto-refresh once per minute and initial fetch (only if not using preloaded stories)
  useEffect(() => {
    if (preloadedStories) return; // Skip if using preloaded stories
    if (rateLimited) return; // Skip if rate limited
    
    const tickersToFetch = Array.from(selectedTickers);
    const currentStoryType = storyType || activeStoryType;
    
    // If no tickers and no story type, don't fetch
    if (tickersToFetch.length === 0 && !currentStoryType) return;

    const fetchIfNeeded = () => {
      // Only fetch if at least 60 seconds have passed since last fetch
      const now = Date.now();
      if (!lastFetchTime || now - lastFetchTime >= 60000) {
        fetchNews(true);
      }
    };

    // Initial fetch
    fetchIfNeeded();

    // Set up auto-refresh interval if enabled - fetch once per minute (60000ms)
    if (autoRefresh) {
      const interval = setInterval(fetchIfNeeded, 60000);
      return () => clearInterval(interval);
    }
  }, [selectedTickers, activeStoryType, storyType, lastFetchTime, autoRefresh, preloadedStories, rateLimited]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rateLimited && waitTime > 0) {
      const timer = setInterval(() => {
        setWaitTime((prev) => {
          if (prev <= 1) {
            setRateLimited(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [rateLimited, waitTime]);

  const fetchNews = async (useCache = true) => {
    const tickersToFetch = Array.from(selectedTickers);
    const currentStoryType = storyType || activeStoryType;
    
    if (tickersToFetch.length === 0 && !currentStoryType) {
      setStories([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    setRateLimited(false);
    
    try {
      const requestBody = {
        n: maxStories,
        use_cache: useCache
      };

      if (currentStoryType) {
        requestBody.story_type = currentStoryType;
      } else if (tickersToFetch.length > 0) {
        requestBody.tickers = tickersToFetch;
      }

      const response = await fetchWithAuth('/api/news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (data.success) {
        setStories(data.stories || []);
        setCached(data.cached || false);
        setLastFetchTime(Date.now());
        setRateLimited(false);
        setWaitTime(0);
        if (data.stories && data.stories.length === 0) {
          setError('No news stories found.');
        }
      } else {
        if (data.rate_limited) {
          const waitSeconds = data.wait_time || 60;
          setRateLimited(true);
          setWaitTime(waitSeconds);
          setError(`Rate limit exceeded. Please wait ${waitSeconds} seconds.`);
          if (!useCache) {
            toast.error(`News API rate limit exceeded. Please wait ${waitSeconds} seconds.`);
          }
          
          // Schedule retry after wait time
          setTimeout(() => {
            setRateLimited(false);
            setWaitTime(0);
            // Retry after wait time
            fetchNews(true);
          }, waitSeconds * 1000);
        } else {
          setError(data.error || 'Failed to fetch news');
          if (!useCache) {
            toast.error(data.error || 'Failed to fetch news');
          }
        }
        setStories([]);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      setError('Failed to fetch news. Please try again later.');
      setStories([]);
      if (!useCache) {
        toast.error('Failed to fetch news');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTickerToggle = (ticker) => {
    const newSelected = new Set(selectedTickers);
    if (newSelected.has(ticker)) {
      newSelected.delete(ticker);
    } else {
      newSelected.add(ticker);
    }
    setSelectedTickers(newSelected);
    
    // Only fetch news if we don't have preloaded stories (client-side filtering will handle it)
    // If we have preloaded stories, the filteredStories memo will handle filtering
    if (!preloadedStories && !activeStoryType) {
      setTimeout(() => fetchNews(true), 100);
    }
  };

  const handleStoryTypeChange = (storyType) => {
    setActiveStoryType(storyType);
    setSelectedTickers(new Set()); // Clear ticker selection when using story types
    setTimeout(() => fetchNews(true), 100);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const timeSinceLastFetch = useMemo(() => {
    if (!lastFetchTime) return null;
    const seconds = Math.floor((Date.now() - lastFetchTime) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  }, [lastFetchTime]);

  // Filter stories based on selected tickers (when using preloaded stories)
  const filteredStories = useMemo(() => {
    // Use all preloaded stories if available, otherwise use current stories
    const storiesToFilter = allPreloadedStoriesRef.current || stories;
    
    if (!storiesToFilter || storiesToFilter.length === 0) return [];
    
    // If using story type, return all stories
    if (storyType || activeStoryType) {
      return storiesToFilter;
    }
    
    // If no tickers selected, return all stories
    if (selectedTickers.size === 0) {
      return storiesToFilter;
    }
    
    // Filter by selected tickers
    return storiesToFilter.filter(story => {
      const storyTickers = story.tickers || [];
      return storyTickers.some(ticker => selectedTickers.has(ticker.toUpperCase()));
    });
  }, [stories, selectedTickers, storyType, activeStoryType]);

  // Don't render if no symbols and no story type (unless storyType prop is provided)
  if ((!symbols || symbols.length === 0) && !storyType && !activeStoryType) {
    return null;
  }

  return (
    <Card className="w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center space-x-3">
          <NewspaperIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
          {!storyType && !activeStoryType && (
            <span className={`text-sm px-2 py-1 rounded-full ${
              theme === 'dark' 
                ? 'bg-gray-700 text-gray-300' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {selectedTickers.size} {selectedTickers.size === 1 ? 'ticker' : 'tickers'}
            </span>
          )}
          {storyType && (
            <span className={`text-sm px-2 py-1 rounded-full ${
              theme === 'dark' 
                ? 'bg-blue-900/30 text-blue-400' 
                : 'bg-blue-100 text-blue-700'
            }`}>
              All US Stocks
            </span>
          )}
          {cached && (
            <span className={`text-xs px-2 py-1 rounded-full ${
              theme === 'dark' 
                ? 'bg-blue-900/30 text-blue-400' 
                : 'bg-blue-100 text-blue-600'
            }`}>
              Cached
            </span>
          )}
          {timeSinceLastFetch && (
            <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
              Updated {timeSinceLastFetch}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {rateLimited && (
            <div className="flex items-center space-x-2 text-orange-600 dark:text-orange-400">
              <ExclamationTriangleIcon className="h-5 w-5" />
              <span className="text-sm font-medium">
                Retry in {waitTime}s
              </span>
            </div>
          )}
          {!rateLimited && !loading && (
            <button
              onClick={() => fetchNews(false)}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Story Type Tabs */}
      {showStoryTypes && !storyType && (
        <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-1 overflow-x-auto">
            {STORY_TYPES.map((type) => {
              const Icon = type.icon;
              const isActive = activeStoryType === type.value;
              return (
                <button
                  key={type.value || 'all'}
                  onClick={() => handleStoryTypeChange(type.value)}
                  className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ticker Selection */}
      {showTickerSelection && !storyType && !activeStoryType && symbols.length > 1 && (
        <div className="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Select Tickers ({selectedTickers.size}/{symbols.length})
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setSelectedTickers(new Set(symbols));
                  // Only fetch if we don't have preloaded stories (client-side filtering will handle it)
                  if (!preloadedStories) {
                    setTimeout(() => fetchNews(true), 100);
                  }
                }}
                className="text-xs px-2 py-1 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                Select All
              </button>
              <button
                onClick={() => {
                  setSelectedTickers(new Set());
                  // Only clear stories if we don't have preloaded stories
                  if (!preloadedStories) {
                    setStories([]);
                  }
                }}
                className="text-xs px-2 py-1 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {symbols.map((ticker) => {
              const isSelected = selectedTickers.has(ticker);
              return (
                <button
                  key={ticker}
                  onClick={() => handleTickerToggle(ticker)}
                  className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white dark:bg-blue-500'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  {isSelected ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <XMarkIcon className="h-4 w-4" />
                  )}
                  <span>{ticker}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : error && !rateLimited ? (
        <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          <p>{error}</p>
          <button
            onClick={() => fetchNews(false)}
            className={`mt-4 px-4 py-2 rounded-lg transition-colors ${
              theme === 'dark'
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Try Again
          </button>
        </div>
      ) : stories.length === 0 ? (
        <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          <NewspaperIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No news stories found.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {filteredStories.map((story) => (
            <a
              key={story.id}
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`block p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
                theme === 'dark'
                  ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600 hover:bg-gray-800'
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-white'
              }`}
            >
              <div className="flex items-start space-x-3">
                {/* Favicon */}
                {story.favicon_url && (
                  <img
                    src={story.favicon_url}
                    alt={story.site}
                    className="w-5 h-5 mt-0.5 flex-shrink-0"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
                
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <h3 className={`text-sm font-semibold mb-1 line-clamp-2 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {story.title}
                  </h3>
                  
                  {/* Description */}
                  {story.description && (
                    <p className={`text-xs mb-2 line-clamp-2 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {story.description}
                    </p>
                  )}
                  
                  {/* Meta info */}
                  <div className="flex items-center space-x-4 text-xs flex-wrap gap-2">
                    <div className={`flex items-center space-x-1 ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      <span className="font-medium">{story.site}</span>
                    </div>
                    <div className={`flex items-center space-x-1 ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      <ClockIcon className="h-3 w-3" />
                      <span>{formatTime(story.time)}</span>
                    </div>
                    {story.tickers && story.tickers.length > 0 && (
                      <div className="flex items-center space-x-1 flex-wrap gap-1">
                        {story.tickers.slice(0, 3).map((ticker) => (
                          <span
                            key={ticker}
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              theme === 'dark'
                                ? 'bg-blue-900/30 text-blue-400'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {ticker.toUpperCase()}
                          </span>
                        ))}
                        {story.tickers.length > 3 && (
                          <span className={`text-xs ${
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                          }`}>
                            +{story.tickers.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* External link icon */}
                <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
              </div>
            </a>
          ))}
        </div>
      )}
    </Card>
  );
};

export default NewsSection;
