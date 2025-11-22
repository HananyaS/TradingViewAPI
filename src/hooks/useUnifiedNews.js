import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithAuth } from '../utils/api';

/**
 * Unified news hook that fetches ALL news data (tickers + story types) in one request
 * Refreshes once every 2 minutes
 */
export const useUnifiedNews = () => {
  const [allNews, setAllNews] = useState({
    tickers: {},
    storyTypes: {},
    metadata: {
      cachedTickers: [],
      cachedStoryTypes: [],
      lastFetch: null
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cached, setCached] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [waitTime, setWaitTime] = useState(0);
  const refreshTimerRef = useRef(null);
  const rateLimitTimerRef = useRef(null);

  const fetchAllNews = useCallback(async (useCache = true) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth('/api/news/unified', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          use_cache: useCache
        })
      });

      const data = await response.json();

      if (data.success) {
        setAllNews(data.data || { tickers: {}, storyTypes: {}, metadata: {} });
        setCached(data.cached || false);
        setLastFetchTime(Date.now());
        setRateLimited(false);
        setWaitTime(0);
      } else {
        if (data.rate_limited) {
          const waitSeconds = data.wait_time || 60;
          setRateLimited(true);
          setWaitTime(waitSeconds);
          setError(`Rate limit exceeded. Please wait ${waitSeconds} seconds.`);
          
          // Schedule retry after wait time
          if (rateLimitTimerRef.current) {
            clearTimeout(rateLimitTimerRef.current);
          }
          rateLimitTimerRef.current = setTimeout(() => {
            setRateLimited(false);
            setWaitTime(0);
            fetchAllNews(true);
          }, waitSeconds * 1000);
        } else {
          setError(data.error || 'Failed to fetch news');
        }
      }
    } catch (err) {
      console.error('Error fetching unified news:', err);
      setError('Failed to fetch news. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh logic - fetch once every 2 minutes (120000ms)
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }

    if (!rateLimited) {
      const fetchIfNeeded = () => {
        // Only fetch if at least 2 minutes (120 seconds) have passed since last fetch
        const now = Date.now();
        if (!lastFetchTime || now - lastFetchTime >= 120000) {
          fetchAllNews(true);
        }
      };

      // Initial fetch
      fetchIfNeeded();

      // Set up interval to fetch once every 2 minutes (120000ms)
      refreshTimerRef.current = setInterval(fetchIfNeeded, 120000);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      if (rateLimitTimerRef.current) {
        clearTimeout(rateLimitTimerRef.current);
      }
    };
  }, [lastFetchTime, rateLimited, fetchAllNews]);

  return {
    allNews,
    loading,
    error,
    cached,
    lastFetchTime,
    rateLimited,
    waitTime,
    refresh: () => fetchAllNews(false)
  };
};

