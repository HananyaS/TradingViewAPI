import React, { useEffect, useState } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import DonutChart from '../components/charts/DonutChart';
import { fetchWithAuth } from '../utils/api';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
  TrashIcon,
  CalculatorIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const formatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2
  }).format(value);
};

const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const Rebalancing = () => {
  const [currentAllocation, setCurrentAllocation] = useState(null);
  const [targetAllocations, setTargetAllocations] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [rebalancingData, setRebalancingData] = useState(null);
  const [taxHarvesting, setTaxHarvesting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState(null);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetName, setTargetName] = useState('');
  const [targetAllocationsList, setTargetAllocationsList] = useState([{ symbol: '', target_pct: 0 }]);
  const [rebalanceThreshold, setRebalanceThreshold] = useState(5.0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        loadCurrentAllocation(),
        loadTargetAllocations(),
        loadTaxHarvesting()
      ]);
    } catch (err) {
      setError('Failed to load data');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentAllocation = async () => {
    try {
      const response = await fetchWithAuth('/api/rebalancing/current');
      const data = await response.json();
      if (data.success) {
        setCurrentAllocation(data.data);
      }
    } catch (err) {
      console.error('Error loading current allocation:', err);
    }
  };

  const loadTargetAllocations = async () => {
    try {
      const response = await fetchWithAuth('/api/rebalancing/targets');
      const data = await response.json();
      if (data.success) {
        setTargetAllocations(data.allocations || []);
        // Auto-select default or first one
        const defaultAlloc = data.allocations.find(a => a.is_default) || data.allocations[0];
        if (defaultAlloc) {
          setSelectedTarget(defaultAlloc);
        }
      }
    } catch (err) {
      console.error('Error loading target allocations:', err);
    }
  };

  const loadTaxHarvesting = async () => {
    try {
      const response = await fetchWithAuth('/api/rebalancing/tax-harvesting');
      const data = await response.json();
      if (data.success) {
        setTaxHarvesting(data.data);
      }
    } catch (err) {
      console.error('Error loading tax harvesting:', err);
    }
  };

  const calculateRebalancing = async () => {
    if (!selectedTarget) {
      setError('Please select a target allocation first');
      return;
    }

    setCalculating(true);
    setError(null);
    try {
      const response = await fetchWithAuth('/api/rebalancing/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          allocation_id: selectedTarget.id
        })
      });

      const data = await response.json();
      if (data.success) {
        setRebalancingData(data.data);
      } else {
        setError(data.error || 'Failed to calculate rebalancing');
      }
    } catch (err) {
      setError('Failed to calculate rebalancing');
      console.error('Rebalancing error:', err);
    } finally {
      setCalculating(false);
    }
  };

  const handleSaveTarget = async () => {
    if (!targetName.trim()) {
      setError('Allocation name is required');
      return;
    }

    const validAllocations = targetAllocationsList.filter(a => a.symbol.trim() && a.target_pct > 0);
    if (validAllocations.length === 0) {
      setError('Please add at least one allocation');
      return;
    }

    const totalPct = validAllocations.reduce((sum, a) => sum + a.target_pct, 0);
    if (Math.abs(totalPct - 100) > 0.01) {
      setError(`Target allocations must sum to 100% (currently ${totalPct.toFixed(2)}%)`);
      return;
    }

    try {
      const response = await fetchWithAuth('/api/rebalancing/targets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: targetName,
          allocations: validAllocations,
          rebalance_threshold: rebalanceThreshold,
          is_default: targetAllocations.length === 0  // First one is default
        })
      });

      const data = await response.json();
      if (data.success) {
        setShowTargetModal(false);
        setTargetName('');
        setTargetAllocationsList([{ symbol: '', target_pct: 0 }]);
        loadTargetAllocations();
      } else {
        setError(data.error || 'Failed to save allocation');
      }
    } catch (err) {
      setError('Failed to save allocation');
      console.error('Save error:', err);
    }
  };

  const handleDeleteTarget = async (allocationId) => {
    if (!window.confirm('Are you sure you want to delete this target allocation?')) {
      return;
    }

    try {
      const response = await fetchWithAuth(`/api/rebalancing/targets/${allocationId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        loadTargetAllocations();
        if (selectedTarget?.id === allocationId) {
          setSelectedTarget(null);
          setRebalancingData(null);
        }
      } else {
        setError(data.error || 'Failed to delete allocation');
      }
    } catch (err) {
      setError('Failed to delete allocation');
      console.error('Delete error:', err);
    }
  };

  const addAllocationRow = () => {
    setTargetAllocationsList([...targetAllocationsList, { symbol: '', target_pct: 0 }]);
  };

  const removeAllocationRow = (index) => {
    if (targetAllocationsList.length > 1) {
      setTargetAllocationsList(targetAllocationsList.filter((_, i) => i !== index));
    }
  };

  const updateAllocation = (index, field, value) => {
    const updated = [...targetAllocationsList];
    updated[index] = { ...updated[index], [field]: value };
    setTargetAllocationsList(updated);
  };

  const totalTargetPct = targetAllocationsList.reduce((sum, a) => sum + (parseFloat(a.target_pct) || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Portfolio Rebalancing</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Maintain your target asset allocation
          </p>
        </div>
        <Button onClick={() => setShowTargetModal(true)}>
          <PlusIcon className="h-5 w-5 mr-2" />
          New Target Allocation
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <ExclamationTriangleIcon className="h-5 w-5" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Current Allocation */}
      {currentAllocation && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Current Portfolio Allocation
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Portfolio Value</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(currentAllocation.total_value)}
                </p>
              </div>
              {currentAllocation.allocations.length > 0 && (
                <DonutChart
                  data={currentAllocation.allocations.map(a => ({
                    symbol: a.symbol,
                    value: a.current_value,
                    percent: a.current_percent
                  }))}
                  size={300}
                />
              )}
            </div>
            <div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {currentAllocation.allocations.length > 0 ? (
                  currentAllocation.allocations.map((alloc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{alloc.symbol}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {alloc.quantity} shares @ {formatCurrency(alloc.current_price)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(alloc.current_value)}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {alloc.current_percent.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    No open positions
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Target Allocation Selection */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Target Allocation
        </h2>
        <div className="space-y-4">
          {targetAllocations.length > 0 ? (
            <>
              <select
                value={selectedTarget?.id || ''}
                onChange={(e) => {
                  const target = targetAllocations.find(a => a.id === e.target.value);
                  setSelectedTarget(target || null);
                  setRebalancingData(null);
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Select a target allocation...</option>
                {targetAllocations.map((alloc) => (
                  <option key={alloc.id} value={alloc.id}>
                    {alloc.name} {alloc.is_default && '(Default)'}
                  </option>
                ))}
              </select>
              {selectedTarget && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedTarget.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Rebalance threshold: {selectedTarget.rebalance_threshold}%
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteTarget(selectedTarget.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {selectedTarget.allocations.map((alloc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">{alloc.symbol}</span>
                        <span className="text-gray-600 dark:text-gray-300">
                          {alloc.target_pct.toFixed(2)}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button onClick={calculateRebalancing} disabled={calculating} className="mt-4 w-full">
                    {calculating ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Calculating...
                      </>
                    ) : (
                      <>
                        <CalculatorIcon className="h-5 w-5 mr-2" />
                        Calculate Rebalancing
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No target allocations defined. Create one to get started.
              </p>
              <Button onClick={() => setShowTargetModal(true)}>
                <PlusIcon className="h-5 w-5 mr-2" />
                Create Target Allocation
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Rebalancing Recommendations */}
      {rebalancingData && (
        <>
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Rebalancing Recommendations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">Needs Rebalancing</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {rebalancingData.needs_rebalance_count}
              </p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total to Buy</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(rebalancingData.total_buy)}
              </p>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total to Sell</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(rebalancingData.total_sell)}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300">Symbol</th>
                  <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Current %</th>
                  <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Target %</th>
                  <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Drift</th>
                  <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Action</th>
                  <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rebalancingData.recommendations.map((rec, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-gray-100 dark:border-gray-800 ${
                      rec.needs_rebalance ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                      {rec.symbol}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                      {rec.current_percent.toFixed(2)}%
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                      {rec.target_percent.toFixed(2)}%
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-medium ${
                          rec.drift > rebalancingData.rebalance_threshold
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {rec.drift.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                          rec.action === 'BUY'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : rec.action === 'SELL'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {rec.action === 'BUY' && <ArrowUpIcon className="h-3 w-3" />}
                        {rec.action === 'SELL' && <ArrowDownIcon className="h-3 w-3" />}
                        {rec.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-medium ${
                          rec.difference > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : rec.difference < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {formatCurrency(Math.abs(rec.difference))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Rebalancing Trades List */}
        {rebalancingData.rebalancing_trades && rebalancingData.rebalancing_trades.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Rebalancing Trades
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Suggested trades to rebalance your portfolio to target allocation
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300">Action</th>
                    <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300">Symbol</th>
                    <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Shares</th>
                    <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Price</th>
                    <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Total Value</th>
                    <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Current %</th>
                    <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Target %</th>
                    <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Drift</th>
                  </tr>
                </thead>
                <tbody>
                  {rebalancingData.rebalancing_trades.map((trade, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                            trade.action === 'BUY'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          }`}
                        >
                          {trade.action === 'BUY' && <ArrowUpIcon className="h-3 w-3" />}
                          {trade.action === 'SELL' && <ArrowDownIcon className="h-3 w-3" />}
                          {trade.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                        {trade.symbol}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                        {trade.shares}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                        {formatCurrency(trade.price)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(trade.total_value)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                        {trade.current_allocation.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                        {trade.target_allocation.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-medium text-yellow-600 dark:text-yellow-400">
                          {trade.drift.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold">
                    <td colSpan="4" className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                      Total:
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                      {formatCurrency(
                        rebalancingData.rebalancing_trades.reduce((sum, t) => sum + t.total_value, 0)
                      )}
                    </td>
                    <td colSpan="3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}
        </>
      )}

      {/* Tax-Loss Harvesting */}
      {taxHarvesting && taxHarvesting.count > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Tax-Loss Harvesting Opportunities
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Unrealized Losses</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(taxHarvesting.total_unrealized_losses)}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">Potential Tax Savings</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(taxHarvesting.total_potential_tax_savings)}
              </p>
            </div>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {taxHarvesting.opportunities.map((opp, idx) => (
              <div
                key={idx}
                className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{opp.symbol}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {opp.quantity} shares • Entry: {formatCurrency(opp.entry_price)} • Current:{' '}
                    {formatCurrency(opp.current_price)}
                  </p>
                  {opp.is_short_term && (
                    <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 rounded">
                      Short-term (held {opp.holding_days} days)
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(opp.unrealized_loss)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Tax savings: {formatCurrency(opp.tax_savings_estimate)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Create Target Allocation Modal */}
      {showTargetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create Target Allocation
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Allocation Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  placeholder="My Target Allocation"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rebalance Threshold (%)
                </label>
                <input
                  type="number"
                  value={rebalanceThreshold}
                  onChange={(e) => setRebalanceThreshold(parseFloat(e.target.value) || 5.0)}
                  min="0"
                  max="50"
                  step="0.1"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Rebalance when allocation drifts more than this percentage from target
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Target Allocations <span className="text-red-500">*</span>
                  </label>
                  <Button onClick={addAllocationRow} size="sm" variant="secondary">
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {targetAllocationsList.map((alloc, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={alloc.symbol}
                        onChange={(e) => updateAllocation(idx, 'symbol', e.target.value.toUpperCase())}
                        placeholder="Symbol"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                      <input
                        type="number"
                        value={alloc.target_pct}
                        onChange={(e) => updateAllocation(idx, 'target_pct', parseFloat(e.target.value) || 0)}
                        placeholder="%"
                        min="0"
                        max="100"
                        step="0.1"
                        className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                      <span className="text-sm text-gray-500 dark:text-gray-400 w-8">%</span>
                      {targetAllocationsList.length > 1 && (
                        <button
                          onClick={() => removeAllocationRow(idx)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Total:</span>
                  <span
                    className={`font-semibold ${
                      Math.abs(totalTargetPct - 100) < 0.01
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {totalTargetPct.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleSaveTarget}
                  disabled={!targetName.trim() || Math.abs(totalTargetPct - 100) > 0.01}
                  className="flex-1"
                >
                  Save Allocation
                </Button>
                <Button
                  onClick={() => {
                    setShowTargetModal(false);
                    setTargetName('');
                    setTargetAllocationsList([{ symbol: '', target_pct: 0 }]);
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Rebalancing;

