import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithAuth } from '../utils/api';

/**
 * Custom hook for fetching news in batches
 * @param {Object} options - Configuration options
 * @param {Array} options.tickers - List of tickers to fetch news for
 * @param {Array} options.storyTypes - List of story types to fetch
 * @param {number} options.maxStories - Maximum stories per request
 * @param {boolean} options.autoRefresh - Whether to auto-refresh
 */
export const useBatchNews = ({ tickers = [], storyTypes = [], maxStories = 50, autoRefresh = true }) => {
  const [tickerNews, setTickerNews] = useState({});
  const [storyTypeNews, setStoryTypeNews] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cached, setCached] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [waitTime, setWaitTime] = useState(0);
  const refreshTimerRef = useRef(null);
  const rateLimitTimerRef = useRef(null);

  const fetchTickerBatch = useCallback(async (useCache = true) => {
    if (!tickers || tickers.length === 0) {
      setTickerNews({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth('/api/news/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'tickers',
          tickers: tickers,
          n: maxStories,
          use_cache: useCache
        })
      });

      const data = await response.json();

      if (data.success) {
        setTickerNews(data.data || {});
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
            // Retry after wait time
            fetchTickerBatch(true);
          }, waitSeconds * 1000);
        } else {
          setError(data.error || 'Failed to fetch news');
        }
        setTickerNews({});
      }
    } catch (err) {
      console.error('Error fetching ticker batch news:', err);
      setError('Failed to fetch news. Please try again later.');
      setTickerNews({});
    } finally {
      setLoading(false);
    }
  }, [tickers, maxStories]);

  const fetchStoryTypeBatch = useCallback(async (useCache = true) => {
    if (!storyTypes || storyTypes.length === 0) {
      setStoryTypeNews({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth('/api/news/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'story_types',
          story_types: storyTypes,
          n: maxStories,
          use_cache: useCache
        })
      });

      const data = await response.json();

      if (data.success) {
        setStoryTypeNews(data.data || {});
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
            // Retry after wait time
            fetchStoryTypeBatch(true);
          }, waitSeconds * 1000);
        } else {
          setError(data.error || 'Failed to fetch news');
        }
        setStoryTypeNews({});
      }
    } catch (err) {
      console.error('Error fetching story type batch news:', err);
      setError('Failed to fetch news. Please try again later.');
      setStoryTypeNews({});
    } finally {
      setLoading(false);
    }
  }, [storyTypes, maxStories]);

  // Auto-refresh logic - fetch once per minute
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }

    if (autoRefresh && !rateLimited) {
      const fetchIfNeeded = () => {
        // Only fetch if at least 60 seconds have passed since last fetch
        const now = Date.now();
        if (!lastFetchTime || now - lastFetchTime >= 60000) {
          if (tickers.length > 0) {
            fetchTickerBatch(true);
          }
          if (storyTypes.length > 0) {
            fetchStoryTypeBatch(true);
          }
        }
      };

      // Initial fetch
      fetchIfNeeded();

      // Set up interval to fetch once per minute (60000ms)
      refreshTimerRef.current = setInterval(fetchIfNeeded, 60000);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      if (rateLimitTimerRef.current) {
        clearTimeout(rateLimitTimerRef.current);
      }
    };
  }, [autoRefresh, tickers.length, storyTypes.length, lastFetchTime, rateLimited, fetchTickerBatch, fetchStoryTypeBatch]);

  return {
    tickerNews,
    storyTypeNews,
    loading,
    error,
    cached,
    lastFetchTime,
    rateLimited,
    waitTime,
    refreshTickerBatch: () => fetchTickerBatch(false),
    refreshStoryTypeBatch: () => fetchStoryTypeBatch(false)
  };
};

