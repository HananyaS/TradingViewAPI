import React, { useEffect, useState } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import BarChart from '../components/charts/BarChart';
import { fetchWithAuth } from '../utils/api';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
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

const TradePerformance = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAnalytics = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      const response = await fetchWithAuth('/api/analytics/trade-performance');
      const data = await response.json();
      if (data.success) {
        setAnalytics(data.data);
      } else {
        setError(data.error || 'Failed to load analytics');
      }
    } catch (err) {
      console.error('Error loading trade performance analytics', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-10 text-center space-y-4">
        <ExclamationTriangleIcon className="w-12 h-12 text-rose-500 mx-auto" />
        <p className="text-gray-700 dark:text-gray-300">{error}</p>
        <Button onClick={() => loadAnalytics()} variant="primary">
          Try again
        </Button>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700">
        <div className="space-y-3 max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">No closed trades yet</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Close some trades in your journal to see detailed performance analytics here.
          </p>
        </div>
      </Card>
    );
  }

  // Safe destructuring with defaults
  const winRate = analytics?.winRate || { byStrategy: [], bySymbol: [], byTimeOfDay: [], byDayOfWeek: [] };
  const holdTime = analytics?.holdTime || { average: null, distribution: [] };
  const profitFactor = analytics?.profitFactor ?? null;
  const expectancy = analytics?.expectancy ?? null;
  const bestWorstSymbols = analytics?.bestWorstSymbols || { best: [], worst: [] };
  const marketConditions = analytics?.marketConditions || {
    bull: { count: 0, winRate: null, avgReturn: null },
    bear: { count: 0, winRate: null, avgReturn: null },
    sideways: { count: 0, winRate: null, avgReturn: null }
  };
  const pnlDistribution = analytics?.pnlDistribution || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-blue-500 dark:text-blue-300">Analytics</p>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Trade Performance Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Deep dive into your trading patterns, win rates, and performance metrics.
          </p>
        </div>
        <Button onClick={() => loadAnalytics(false)} disabled={refreshing} className="flex items-center gap-2">
          <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10">
              <ChartBarIcon className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Profit Factor</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {profitFactor !== null ? profitFactor.toFixed(2) : '—'}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {profitFactor && profitFactor > 1 ? 'Profitable strategy' : profitFactor && profitFactor < 1 ? 'Needs improvement' : 'No data'}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
              <ArrowTrendingUpIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Expectancy</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {expectancy !== null ? formatCurrency(expectancy) : '—'}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Average expected value per trade</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-500/10">
              <ClockIcon className="h-5 w-5 text-purple-600 dark:text-purple-300" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Hold Time</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {holdTime.average !== null ? `${holdTime.average} days` : '—'}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Average days per trade</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10">
              <ChartBarIcon className="h-5 w-5 text-amber-600 dark:text-amber-300" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Closed Trades</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {winRate?.bySymbol?.reduce((sum, item) => sum + (item.totalTrades || 0), 0) || 0}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Analyzed trades</p>
        </Card>
      </div>

      {/* Win Rate Analysis */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Win Rate by Strategy</h3>
          {!winRate?.byStrategy || winRate.byStrategy.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No strategy data available</p>
          ) : (
            <div className="space-y-3">
              {winRate.byStrategy.map((item) => (
                <div key={item.strategy} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900 dark:text-white">{item.strategy}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-600 dark:text-gray-400">{item.winRate}%</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">({item.totalTrades} trades)</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full ${
                        item.winRate >= 50 ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(item.winRate, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Win Rate by Symbol</h3>
          {!winRate?.bySymbol || winRate.bySymbol.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No symbol data available</p>
          ) : (
            <div className="space-y-3">
              {winRate.bySymbol.slice(0, 10).map((item) => (
                <div key={item.symbol} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900 dark:text-white">{item.symbol}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-600 dark:text-gray-400">{item.winRate}%</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">({item.totalTrades} trades)</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full ${
                        item.winRate >= 50 ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(item.winRate, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Time-based Analysis */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Win Rate by Time of Day</h3>
          {!winRate?.byTimeOfDay || winRate.byTimeOfDay.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No time data available</p>
          ) : (
            <BarChart
              data={winRate.byTimeOfDay.map((item) => ({
                label: item.time,
                count: item.winRate,
                value: item.winRate
              }))}
              height={200}
              barColor="#2563eb"
              xAxisLabel="Time of Day"
              yAxisLabel="Win Rate (%)"
            />
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Win Rate by Day of Week</h3>
          {!winRate?.byDayOfWeek || winRate.byDayOfWeek.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No day data available</p>
          ) : (
            <BarChart
              data={winRate.byDayOfWeek.map((item) => ({
                label: item.day,
                count: item.winRate,
                value: item.winRate
              }))}
              height={200}
              barColor="#8b5cf6"
              xAxisLabel="Day of Week"
              yAxisLabel="Win Rate (%)"
            />
          )}
        </Card>
      </div>

      {/* Hold Time Analysis */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Hold Time Distribution</h3>
        {!holdTime?.distribution || holdTime.distribution.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No hold time data available</p>
        ) : (
          <div className="space-y-4">
            <BarChart
              data={holdTime.distribution.map((item) => ({
                label: item.bucket,
                count: item.count,
                value: item.count
              }))}
              height={200}
              barColor="#10b981"
              xAxisLabel="Hold Time"
              yAxisLabel="Number of Trades"
            />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
              {holdTime.distribution.map((item) => (
                <div key={item.bucket} className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{item.count}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.bucket}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Best/Worst Symbols */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowTrendingUpIcon className="h-5 w-5 text-emerald-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Best Performing Symbols</h3>
          </div>
          {!bestWorstSymbols?.best || bestWorstSymbols.best.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No data available</p>
          ) : (
            <div className="space-y-3">
              {bestWorstSymbols.best.map((item) => (
                <div
                  key={item.symbol}
                  className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20"
                >
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{item.symbol}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.totalTrades} trades</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(item.totalPnL)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Avg: {formatCurrency(item.avgReturn)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowTrendingDownIcon className="h-5 w-5 text-rose-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Worst Performing Symbols</h3>
          </div>
          {!bestWorstSymbols?.worst || bestWorstSymbols.worst.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No data available</p>
          ) : (
            <div className="space-y-3">
              {bestWorstSymbols.worst.map((item) => (
                <div
                  key={item.symbol}
                  className="flex items-center justify-between p-3 rounded-lg bg-rose-50/50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20"
                >
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{item.symbol}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.totalTrades} trades</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-rose-600 dark:text-rose-400">
                      {formatCurrency(item.totalPnL)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Avg: {formatCurrency(item.avgReturn)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Market Conditions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance by Market Conditions</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {['bull', 'bear', 'sideways'].map((condition) => {
            const stats = marketConditions?.[condition] || { count: 0, winRate: null, avgReturn: null };
            const colors = {
              bull: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30',
              bear: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30',
              sideways: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            };
            const labels = {
              bull: 'Bull Market',
              bear: 'Bear Market',
              sideways: 'Sideways Market'
            };

            return (
              <div key={condition} className={`p-4 rounded-lg border ${colors[condition]}`}>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{labels[condition]}</p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Trades</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{stats.count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Win Rate</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {stats.winRate !== null ? `${stats.winRate}%` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Avg Return</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {stats.avgReturn !== null ? formatPercent(stats.avgReturn) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* P&L Distribution */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">P&L Distribution</h3>
        {!pnlDistribution || pnlDistribution.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No distribution data available</p>
        ) : (
          <BarChart
            data={pnlDistribution.map((item) => ({
              label: item.range,
              count: item.count,
              value: item.count
            }))}
            height={250}
            barColor="#f59e0b"
            xAxisLabel="P&L Range"
            yAxisLabel="Number of Trades"
          />
        )}
      </Card>
    </div>
  );
};

export default TradePerformance;

