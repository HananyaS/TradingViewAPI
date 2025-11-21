import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '../utils/api';
import { useLivePrices } from '../hooks/useLivePrices';
import {
  BookmarkIcon,
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

const Watchlist = () => {
  const { theme } = useTheme();
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEntry, setNewEntry] = useState({
    symbol: '',
    notes: '',
    target_price: '',
    stop_loss: ''
  });
  const symbolInputRef = useRef(null);
  const { prices: priceLookup, loading: priceLoading } = useLivePrices(
    watchlist.map((item) => item.symbol)
  );

  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/watchlist/items');
      const data = await response.json();
      
      if (data.success) {
        const items = data.items || [];
        setWatchlist(items);
      } else {
        toast.error(data.error || 'Failed to load watchlist');
      }
    } catch (error) {
      console.error('Error loading watchlist:', error);
      toast.error('Failed to load watchlist');
    } finally {
      setLoading(false);
    }
  };

  const addSymbol = async () => {
    const trimmedSymbol = newEntry.symbol.trim().toUpperCase();
    if (!trimmedSymbol) {
      toast.error('Please enter a symbol');
      return;
    }

    try {
      const response = await fetchWithAuth('/api/watchlist/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: trimmedSymbol,
          notes: newEntry.notes,
          target_price: newEntry.target_price ? Number(newEntry.target_price) : undefined,
          stop_loss: newEntry.stop_loss ? Number(newEntry.stop_loss) : undefined
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`Added ${trimmedSymbol} to your watchlist`);
        setNewEntry({
          symbol: '',
          notes: '',
          target_price: '',
          stop_loss: ''
        });
        await loadWatchlist();
        symbolInputRef.current?.focus();
      } else {
        toast.error(data.error || 'Failed to add symbol');
      }
    } catch (error) {
      console.error('Error adding symbol:', error);
      toast.error('Error adding symbol');
    }
  };

  const removeSymbol = async (itemId, symbol) => {
    try {
      const response = await fetchWithAuth(`/api/watchlist/items/${itemId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`Removed ${symbol} from your watchlist`);
        await loadWatchlist();
      } else {
        toast.error(data.error || 'Failed to remove symbol');
      }
    } catch (error) {
      console.error('Error removing symbol:', error);
      toast.error('Error removing symbol');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <BookmarkIcon className="h-8 w-8 mr-3 text-blue-600 dark:text-blue-400" />
            Watchlist
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Track your favorite stocks and monitor their performance
          </p>
        </div>
      </div>

      {/* Add Symbol Card */}
      <Card>
        <div className="flex flex-col space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <input
              ref={symbolInputRef}
              type="text"
              value={newEntry.symbol}
              onChange={(e) => setNewEntry({ ...newEntry, symbol: e.target.value.toUpperCase() })}
              onKeyDown={(e) => e.key === 'Enter' && addSymbol()}
              placeholder="Ticker (e.g., AAPL)"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
            <input
              type="number"
              value={newEntry.target_price}
              onChange={(e) => setNewEntry({ ...newEntry, target_price: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addSymbol()}
              placeholder="Target price"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
            <input
              type="number"
              value={newEntry.stop_loss}
              onChange={(e) => setNewEntry({ ...newEntry, stop_loss: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addSymbol()}
              placeholder="Stop loss"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
            <Button
              onClick={addSymbol}
              variant="primary"
              icon={<PlusIcon className="h-5 w-5" />}
            >
              Add Stock
            </Button>
          </div>
          <textarea
            value={newEntry.notes}
            onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
            placeholder="Notes (optional)"
            rows={2}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              theme === 'dark'
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <div className={`flex items-center space-x-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          <MagnifyingGlassIcon className="h-4 w-4" />
          <span>{watchlist.length} {watchlist.length === 1 ? 'symbol' : 'symbols'} tracked</span>
        </div>
        {priceLoading && (
          <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
            Updating prices…
          </span>
        )}
      </div>

      {/* Watchlist Grid */}
      {watchlist.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookmarkIcon}
            title="Your watchlist is empty"
            description="Start by adding some stocks to track"
            action={
              <Button
                onClick={() => symbolInputRef.current?.focus()}
                variant="primary"
                icon={<PlusIcon className="h-5 w-5" />}
              >
                Add Your First Stock
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {watchlist.map((item) => {
            const symbol = item.symbol;
            const priceData = priceLookup[symbol] || {};
            const lastPrice = priceData.current;
            const changePercent = priceData.changePercent;
            const changeValue = priceData.change;
            const hasChange = typeof changePercent === 'number';
            const changeClass = hasChange
              ? changePercent >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
              : 'text-gray-500 dark:text-gray-400';

            return (
              <Card key={item._id || symbol} hover className="group">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {symbol}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {item.notes || 'No notes yet'}
                  </p>
                </div>
                <button
                  onClick={() => removeSymbol(item._id, symbol)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Remove from watchlist"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Price</span>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {lastPrice !== undefined ? `$${Number(lastPrice).toFixed(2)}` : '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Change</span>
                  <span className={`text-sm font-semibold ${changeClass}`}>
                    {hasChange
                      ? `${changePercent >= 0 ? '+' : ''}${Number(changePercent).toFixed(2)}%${
                          typeof changeValue === 'number'
                            ? ` (${changeValue >= 0 ? '+' : ''}${Number(changeValue).toFixed(2)})`
                            : ''
                        }`
                      : '--'}
                  </span>
                </div>
                {(item.target_price || item.stop_loss) && (
                  <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                    {item.target_price && (
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Target</p>
                        <p className="font-semibold text-gray-900 dark:text-white">${Number(item.target_price).toFixed(2)}</p>
                      </div>
                    )}
                    {item.stop_loss && (
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Stop</p>
                        <p className="font-semibold text-gray-900 dark:text-white">${Number(item.stop_loss).toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  onClick={() => window.open(`https://www.tradingview.com/symbols/${symbol}`, '_blank')}
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  icon={<ChartBarIcon className="h-4 w-4" />}
                >
                  View on TradingView
                </Button>
              </div>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Watchlist;

