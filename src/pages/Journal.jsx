import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import NewsSection from '../components/NewsSection';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '../utils/api';
import { useLivePrices } from '../hooks/useLivePrices';
import { useNews } from '../contexts/NewsContext';
import {
  DocumentTextIcon,
  PlusIcon,
  TrashIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline';

const getDefaultTrade = () => ({
  symbol: '',
  entry_price: '',
  exit_price: '',
  quantity: '',
  trade_date: new Date().toISOString().split('T')[0],
  notes: '',
  strategy: '',
  direction: 'long'
});

const Journal = () => {
  const { theme } = useTheme();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [newTrade, setNewTrade] = useState(getDefaultTrade());
  const [editingTrade, setEditingTrade] = useState(null);

  const { prices: priceLookup, loading: priceLoading } = useLivePrices(
    trades.map((trade) => trade.symbol)
  );

  // Get unified news data
  const { allNews } = useNews();
  const journalSymbols = [...new Set(trades.map((trade) => trade.symbol).filter(Boolean))];
  
  // Extract ticker news from unified data
  const tickerNews = allNews?.tickers || {};

  const normalizeTrade = (trade) => ({
    ...trade,
    id: trade._id || trade.id,
    trade_date: trade.trade_date || trade.date,
    entry_price: trade.entry_price ?? trade.price
  });

  useEffect(() => {
    loadTrades();
  }, []);

  const loadTrades = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/journal/trades');
      const data = await response.json();
      
      if (data.success) {
        const normalized = (data.trades || []).map(normalizeTrade);
        setTrades(normalized);
      } else {
        toast.error(data.error || 'Failed to load journal');
      }
    } catch (error) {
      console.error('Error loading trades:', error);
      toast.error('Failed to load journal');
    } finally {
      setLoading(false);
    }
  };

  const addTrade = async () => {
    if (!newTrade.symbol || !newTrade.entry_price || !newTrade.quantity) {
      toast.error('Symbol, entry price, and quantity are required');
      return;
    }

    try {
      const payload = {
        symbol: newTrade.symbol.trim().toUpperCase(),
        type: newTrade.direction,
        price: Number(newTrade.entry_price),
        quantity: Number(newTrade.quantity),
        date: newTrade.trade_date,
        notes: newTrade.notes,
        strategy: newTrade.strategy,
        exit_price:
          newTrade.exit_price === '' ||
          newTrade.exit_price === null ||
          newTrade.exit_price === undefined
            ? undefined
            : Number(newTrade.exit_price)
      };

      const response = await fetchWithAuth('/api/journal/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Trade added to journal');
        setShowAddModal(false);
        setNewTrade(getDefaultTrade());
        await loadTrades();
      } else {
        toast.error(data.error || 'Failed to add trade');
      }
    } catch (error) {
      console.error('Error adding trade:', error);
      toast.error('Error adding trade');
    }
  };

  const deleteTrade = async (tradeId) => {
    try {
      const response = await fetchWithAuth(`/api/journal/trades/${tradeId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Trade removed from journal');
        await loadTrades();
      } else {
        toast.error(data.error || 'Failed to delete trade');
      }
    } catch (error) {
      console.error('Error deleting trade:', error);
      toast.error('Error deleting trade');
    }
  };

  const startEditTrade = (trade) => {
    setEditingTrade({
      ...trade,
      symbol: trade.symbol || '',
      trade_date: (trade.trade_date || newTrade.trade_date),
      entry_price: trade.entry_price ?? trade.price ?? '',
      exit_price: trade.exit_price ?? '',
      quantity: trade.quantity ?? '',
      direction: trade.type || trade.direction || 'long',
      notes: trade.notes || '',
      strategy: trade.strategy || ''
    });
    setShowEditModal(true);
  };

  const updateEditingField = (field, value) => {
    setEditingTrade((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingTrade(null);
  };

  const updateTrade = async () => {
    if (!editingTrade?.id) return;
    if (!editingTrade.symbol || !editingTrade.entry_price || !editingTrade.quantity) {
      toast.error('Symbol, entry price, and quantity are required');
      return;
    }

    try {
      const exitPrice =
        editingTrade.exit_price === '' || editingTrade.exit_price === null || editingTrade.exit_price === undefined
          ? null
          : Number(editingTrade.exit_price);
      const payload = {
        symbol: editingTrade.symbol.trim().toUpperCase(),
        type: editingTrade.direction,
        price: Number(editingTrade.entry_price),
        quantity: Number(editingTrade.quantity),
        date: editingTrade.trade_date,
        notes: editingTrade.notes,
        strategy: editingTrade.strategy,
        exit_price: exitPrice
      };

      const response = await fetchWithAuth(`/api/journal/trades/${editingTrade.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Trade updated');
        if (data.trade) {
          const normalized = normalizeTrade(data.trade);
          setTrades((prev) => prev.map((trade) => (trade.id === normalized.id ? normalized : trade)));
        } else {
          await loadTrades();
        }
        closeEditModal();
      } else {
        toast.error(data.error || 'Failed to update trade');
      }
    } catch (error) {
      console.error('Error updating trade:', error);
      toast.error('Error updating trade');
    }
  };

  const getDirectionMultiplier = (trade) => {
    const direction = (trade.type || trade.direction || 'long').toLowerCase();
    return direction === 'short' ? -1 : 1;
  };

  const getEvaluatedExitPrice = (trade) => {
    if (trade.exit_price !== undefined && trade.exit_price !== null && trade.exit_price !== '') {
      return Number(trade.exit_price);
    }
    const livePrice = priceLookup[trade.symbol]?.current;
    return typeof livePrice === 'number' ? Number(livePrice) : null;
  };

  const calculatePnL = (trade) => {
    const entry = Number(trade.entry_price ?? trade.price);
    const exit = getEvaluatedExitPrice(trade);
    if (!trade.quantity || Number.isNaN(entry) || Number.isNaN(exit)) return null;
    const qty = Number(trade.quantity);
    return (exit - entry) * qty * getDirectionMultiplier(trade);
  };

  const calculatePnLPercentage = (trade) => {
    const entry = Number(trade.entry_price ?? trade.price);
    const exit = getEvaluatedExitPrice(trade);
    if (Number.isNaN(entry) || Number.isNaN(exit) || entry === 0) return null;
    return ((exit - entry) / entry) * 100 * getDirectionMultiplier(trade);
  };

  const stats = useMemo(() => {
    if (!trades.length) {
      return {
        totalTrades: 0,
        closedTrades: 0,
        winRate: 0,
        avgPnL: 0,
        totalPnL: 0,
        bestTrade: null,
        worstTrade: null
      };
    }

    const closedPnLs = trades
      .map((trade) => ({
        trade,
        pnl: calculatePnL(trade),
        pnlPct: calculatePnLPercentage(trade)
      }))
      .filter(({ pnl }) => pnl !== null);

    const closedTrades = closedPnLs.length;
    const wins = closedPnLs.filter(({ pnl }) => pnl > 0).length;
    const totalPnL = closedPnLs.reduce((sum, { pnl }) => sum + pnl, 0);
    const avgPnL = closedTrades ? totalPnL / closedTrades : 0;
    const bestTrade = closedPnLs.reduce(
      (best, current) => (best === null || current.pnl > best.pnl ? current : best),
      null
    );
    const worstTrade = closedPnLs.reduce(
      (worst, current) => (worst === null || current.pnl < worst.pnl ? current : worst),
      null
    );

    return {
      totalTrades: trades.length,
      closedTrades,
      winRate: closedTrades ? (wins / closedTrades) * 100 : 0,
      avgPnL,
      totalPnL,
      bestTrade,
      worstTrade
    };
  }, [trades]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <DocumentTextIcon className="h-6 w-6 sm:h-8 sm:w-8 mr-2 sm:mr-3 text-blue-600 dark:text-blue-400" />
            Trading Journal
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 sm:mt-2 text-sm sm:text-base">
            Track and analyze your trading performance
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          {trades.length > 0 && (
            <Button
              onClick={() => setShowStatsModal(true)}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              View Stats
            </Button>
          )}
        <Button
          onClick={() => setShowAddModal(true)}
          variant="primary"
          icon={<PlusIcon className="h-5 w-5" />}
            className="w-full sm:w-auto"
        >
          Add Trade
        </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <Card>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Trades</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{trades.length}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Winning Trades</div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {trades.filter(t => (calculatePnL(t) || 0) > 0).length}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Losing Trades</div>
          <div className="text-3xl font-bold text-red-600 dark:text-red-400">
            {trades.filter(t => (calculatePnL(t) || 0) < 0).length}
          </div>
        </Card>
      </div>

      {trades.length === 0 ? (
        <Card>
          <EmptyState
            icon={DocumentTextIcon}
            title="Your journal is empty"
            description="Start tracking your trades to improve your performance"
            action={
              <Button
                onClick={() => setShowAddModal(true)}
                variant="primary"
                icon={<PlusIcon className="h-5 w-5" />}
              >
                Add Your First Trade
              </Button>
            }
          />
        </Card>
      ) : (
        <Card padding="p-0">
          <div className="overflow-x-auto w-full">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                    <th className="px-2 sm:px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Date</th>
                    <th className="px-2 sm:px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Symbol</th>
                    <th className="px-2 sm:px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell whitespace-nowrap">Type</th>
                    <th className="px-2 sm:px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Entry</th>
                    <th className="px-2 sm:px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Exit</th>
                    <th className="px-2 sm:px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell whitespace-nowrap">Qty</th>
                    <th className="px-2 sm:px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">P&L</th>
                    <th className="px-2 sm:px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {trades.map((trade) => {
                  const pnl = calculatePnL(trade);
                  const pnlPercent = calculatePnLPercentage(trade);
                  
                  return (
                    <tr key={trade.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white">
                        {trade.trade_date ? new Date(trade.trade_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: window.innerWidth >= 640 ? 'numeric' : '2-digit' }) : '--'}
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap">
                        <span className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm">{trade.symbol}</span>
                        <span className="sm:hidden ml-1 text-xs text-gray-500 dark:text-gray-400 capitalize">({trade.type || trade.direction || '—'})</span>
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white capitalize hidden sm:table-cell">
                        {trade.type || trade.direction || '—'}
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white">
                        {trade.entry_price ? `$${parseFloat(trade.entry_price).toFixed(2)}` : '--'}
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white">
                        {trade.exit_price ? (
                          `$${parseFloat(trade.exit_price).toFixed(2)}`
                        ) : priceLookup[trade.symbol]?.current !== undefined ? (
                          <span>
                            ${Number(priceLookup[trade.symbol].current).toFixed(2)}
                            <span className="ml-1 text-xs text-blue-500">Live</span>
                          </span>
                        ) : (
                          '--'
                        )}
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white hidden md:table-cell">
                        {trade.quantity || '--'}
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap">
                        {pnl !== null ? (
                          <div>
                            <div className={`text-xs sm:text-sm font-semibold ${pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                            </div>
                            {pnlPercent !== null && (
                              <div className={`text-xs ${pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs sm:text-sm text-gray-500">
                            {priceLoading ? 'Updating...' : 'Waiting'}
                          </span>
                        )}
                      </td>
                      <td className="px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <button
                            onClick={() => startEditTrade(trade)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1"
                            title="Edit trade"
                          >
                            <PencilSquareIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                          </button>
                        <button
                          onClick={() => deleteTrade(trade.id)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
                            title="Delete trade"
                        >
                            <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </Card>
      )}

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Trade to Journal"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Symbol *</label>
              <input
                type="text"
                value={newTrade.symbol}
                onChange={(e) => setNewTrade({ ...newTrade, symbol: e.target.value.toUpperCase() })}
                className={`w-full px-3 py-2.5 border rounded-lg text-base ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                placeholder="AAPL"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input
                type="date"
                value={newTrade.trade_date}
                onChange={(e) => setNewTrade({ ...newTrade, trade_date: e.target.value })}
                className={`w-full px-3 py-2.5 border rounded-lg text-base ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Entry Price *</label>
              <input
                type="number"
                step="0.01"
                value={newTrade.entry_price}
                onChange={(e) => setNewTrade({ ...newTrade, entry_price: e.target.value })}
                className={`w-full px-3 py-2.5 border rounded-lg text-base ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exit Price</label>
              <input
                type="number"
                step="0.01"
                value={newTrade.exit_price}
                onChange={(e) => setNewTrade({ ...newTrade, exit_price: e.target.value })}
                className={`w-full px-3 py-2.5 border rounded-lg text-base ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity *</label>
              <input
                type="number"
                value={newTrade.quantity}
                onChange={(e) => setNewTrade({ ...newTrade, quantity: e.target.value })}
                className={`w-full px-3 py-2.5 border rounded-lg text-base ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                placeholder="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
              <select
                value={newTrade.direction}
                onChange={(e) => setNewTrade({ ...newTrade, direction: e.target.value })}
                className={`w-full px-3 py-2.5 border rounded-lg text-base ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Strategy</label>
            <input
              type="text"
              value={newTrade.strategy}
              onChange={(e) => setNewTrade({ ...newTrade, strategy: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              placeholder="e.g., Breakout, Momentum"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={newTrade.notes}
              onChange={(e) => setNewTrade({ ...newTrade, notes: e.target.value })}
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              placeholder="Trade notes and observations..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button onClick={() => setShowAddModal(false)} variant="outline">
              Cancel
            </Button>
            <Button onClick={addTrade} variant="primary">
              Add Trade
            </Button>
          </div>
        </div>
      </Modal>

      {showEditModal && editingTrade && (
        <Modal
          isOpen={showEditModal}
          onClose={closeEditModal}
          title={`Edit Trade - ${editingTrade.symbol}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Symbol *</label>
                <input
                  type="text"
                  value={editingTrade.symbol}
                  onChange={(e) => updateEditingField('symbol', e.target.value.toUpperCase())}
                  className={`w-full px-3 py-2.5 border rounded-lg text-base ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                <input
                  type="date"
                  value={editingTrade.trade_date}
                  onChange={(e) => updateEditingField('trade_date', e.target.value)}
                  className={`w-full px-3 py-2.5 border rounded-lg text-base ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Entry Price *</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingTrade.entry_price}
                  onChange={(e) => updateEditingField('entry_price', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exit Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingTrade.exit_price}
                  onChange={(e) => updateEditingField('exit_price', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity *</label>
                <input
                  type="number"
                  value={editingTrade.quantity}
                  onChange={(e) => updateEditingField('quantity', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <select
                  value={editingTrade.direction}
                  onChange={(e) => updateEditingField('direction', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                >
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Strategy</label>
              <input
                type="text"
                value={editingTrade.strategy}
                onChange={(e) => updateEditingField('strategy', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <textarea
                value={editingTrade.notes}
                onChange={(e) => updateEditingField('notes', e.target.value)}
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button onClick={closeEditModal} variant="outline">
                Cancel
              </Button>
              <Button onClick={updateTrade} variant="primary">
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showStatsModal && (
        <Modal
          isOpen={showStatsModal}
          onClose={() => setShowStatsModal(false)}
          title="Portfolio & Trade Stats"
          size="lg"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Trades</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalTrades}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {stats.closedTrades} closed / {stats.totalTrades - stats.closedTrades} open
              </p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500 dark:text-gray-400">Win Rate</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.closedTrades ? `${stats.winRate.toFixed(1)}%` : '--'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Closed positions only</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total P&L</p>
              <p
                className={`text-3xl font-bold ${
                  stats.totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {stats.closedTrades ? `${stats.totalPnL >= 0 ? '+' : ''}$${stats.totalPnL.toFixed(2)}` : '--'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Closed trades cumulative</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500 dark:text-gray-400">Average P&L</p>
              <p
                className={`text-3xl font-bold ${
                  stats.avgPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {stats.closedTrades ? `${stats.avgPnL >= 0 ? '+' : ''}$${stats.avgPnL.toFixed(2)}` : '--'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Per closed trade</p>
            </Card>
          </div>

          {stats.closedTrades > 0 && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Best Trade</p>
                {stats.bestTrade ? (
                  <div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {stats.bestTrade.trade.symbol}{' '}
                      <span className="text-sm text-gray-500">
                        ({stats.bestTrade.trade.type || stats.bestTrade.trade.direction || 'long'})
                      </span>
                    </p>
                    <p className="text-green-600 dark:text-green-400 font-semibold">
                      +${stats.bestTrade.pnl.toFixed(2)} (
                      {stats.bestTrade.pnlPct !== null ? `${stats.bestTrade.pnlPct.toFixed(2)}%` : '--'})
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No closed trades yet.</p>
                )}
              </Card>
              <Card>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Toughest Trade</p>
                {stats.worstTrade ? (
                  <div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {stats.worstTrade.trade.symbol}{' '}
                      <span className="text-sm text-gray-500">
                        ({stats.worstTrade.trade.type || stats.worstTrade.trade.direction || 'long'})
                      </span>
                    </p>
                    <p className="text-red-600 dark:text-red-400 font-semibold">
                      {stats.worstTrade.pnl >= 0 ? '+' : ''}${stats.worstTrade.pnl.toFixed(2)} (
                      {stats.worstTrade.pnlPct !== null ? `${stats.worstTrade.pnlPct.toFixed(2)}%` : '--'})
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No closed trades yet.</p>
                )}
              </Card>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <Button onClick={() => setShowStatsModal(false)} variant="outline">
              Close
            </Button>
          </div>
        </Modal>
      )}

      {/* News Section - Only ticker-specific news */}
      {trades.length > 0 && (
        <NewsSection
          symbols={journalSymbols}
          title="Trading Journal News"
          maxStories={30}
          showTickerSelection={true}
          showStoryTypes={false}
          autoRefresh={false} // Batch hook handles refresh
          preloadedStories={tickerNews.all_stories || null}
        />
      )}
    </div>
  );
};

export default Journal;

