import { useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '../utils/api';

const normalizeSymbols = (symbols = []) =>
  Array.from(new Set(symbols.filter(Boolean).map((symbol) => symbol.toUpperCase()))).sort();

export const useLivePrices = (symbols = [], refreshInterval = 30000) => {
  const normalizedSymbols = useMemo(() => normalizeSymbols(symbols), [symbols.join(',')]);
  const symbolsKey = normalizedSymbols.join(',');

  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!normalizedSymbols.length) {
      setPrices({});
      return;
    }

    const loadCachedPrices = async () => {
      try {
        const params = new URLSearchParams();
        normalizedSymbols.forEach((symbol) => params.append('symbols[]', symbol));
        console.log('[useLivePrices] Loading cached prices', {
          symbols: normalizedSymbols,
          url: `/api/prices/cache?${params.toString()}`
        });
        const response = await fetchWithAuth(`/api/prices/cache?${params.toString()}`);
        const data = await response.json();
        if (isMounted && data.success) {
          console.log('[useLivePrices] Cached price response', data);
          setPrices((prev) => ({ ...prev, ...(data.prices || {}) }));
        } else if (isMounted) {
          console.warn('[useLivePrices] Failed to load cached prices', data);
        }
      } catch (error) {
        console.error('Error loading cached prices:', error);
      }
    };

    const fetchLivePrices = async () => {
      try {
        setLoading(true);
        console.log('[useLivePrices] Fetching live prices', {
          symbols: normalizedSymbols,
          refreshInterval
        });
        const response = await fetchWithAuth('/api/prices/fetch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ symbols: normalizedSymbols }),
        });
        const data = await response.json();
        if (isMounted && data.success) {
          console.log('[useLivePrices] Live price response', data);
          setPrices((prev) => ({ ...prev, ...(data.prices || {}) }));
        } else if (isMounted) {
          console.warn('[useLivePrices] Failed to fetch live prices', data);
        }
      } catch (error) {
        console.error('Error fetching live prices:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadCachedPrices();
    const initialFetch = fetchLivePrices();
    const intervalId = setInterval(fetchLivePrices, refreshInterval);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      initialFetch.catch((err) => console.error('Initial price fetch error', err));
    };
  }, [symbolsKey, refreshInterval]);

  return { prices, loading };
};

