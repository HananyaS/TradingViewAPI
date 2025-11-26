import React, { useEffect, useMemo, useState } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import MiniAreaChart from '../components/charts/MiniAreaChart';
import DonutChart from '../components/charts/DonutChart';
import { fetchWithAuth } from '../utils/api';
import {
  ArrowUpRightIcon,
  ArrowDownRightIcon,
  ArrowPathIcon,
  TrophyIcon,
  ExclamationTriangleIcon
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

const TrendBadge = ({ value }) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="text-xs font-medium text-gray-400">—</span>;
  }

  const isPositive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
        isPositive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300'
      }`}
    >
      {isPositive ? (
        <ArrowUpRightIcon className="h-3.5 w-3.5" />
      ) : (
        <ArrowDownRightIcon className="h-3.5 w-3.5" />
      )}
      {formatPercent(value)}
    </span>
  );
};

const ExposureBar = ({ longExposure = 0, shortExposure = 0 }) => {
  const total = longExposure + shortExposure || 1;
  const longPercent = (longExposure / total) * 100;
  const shortPercent = (shortExposure / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>Exposure</span>
        <span>{formatCurrency(total)}</span>
      </div>
      <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
        <div className="bg-emerald-500/80" style={{ width: `${longPercent}%` }} aria-label="Long exposure"></div>
        <div className="bg-rose-500/80" style={{ width: `${shortPercent}%` }} aria-label="Short exposure"></div>
      </div>
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>Long {longPercent.toFixed(1)}%</span>
        <span>Short {shortPercent.toFixed(1)}%</span>
      </div>
    </div>
  );
};

const EmptyState = () => (
  <Card className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700">
    <div className="space-y-3 max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Add trades to unlock analytics</h2>
      <p className="text-gray-600 dark:text-gray-400">
        Once you record trades in your journal, we’ll automatically compute portfolio value, allocation, risk metrics,
        and performance charts right here.
      </p>
    </div>
  </Card>
);

const Analysis = () => {
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
      const response = await fetchWithAuth('/api/analytics/portfolio');
      const data = await response.json();
      if (data.success) {
        setAnalytics(data.data);
      } else {
        setError(data.error || 'Failed to load analytics');
      }
    } catch (err) {
      console.error('Error loading analytics', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const summaryCards = useMemo(() => {
    if (!analytics) return [];
    const { summary } = analytics;
    return [
      {
        label: 'Total Capital',
        value: formatCurrency(summary.totalCapital),
        sublabel: 'Committed across all trades',
        trend: summary.totalPnL
      },
      {
        label: 'Realized P&L',
        value: formatCurrency(summary.realizedPnL),
        sublabel: 'Closed trades',
        trend: summary.realizedPnL
      },
      {
        label: 'Unrealized P&L',
        value: formatCurrency(summary.unrealizedPnL),
        sublabel: 'Open trades',
        trend: summary.unrealizedPnL
      },
      {
        label: 'Win Rate',
        value: summary.winRate !== null ? `${summary.winRate.toFixed(1)}%` : '—',
        sublabel: `${summary.closedTrades} closed trades`,
        trend: summary.avgReturn
      },
      {
        label: 'Open Positions',
        value: summary.openPositions,
        sublabel: 'Currently active',
        trend: summary.exposure?.long - summary.exposure?.short || 0
      }
    ];
  }, [analytics]);

  const portfolioSnapshot = useMemo(() => {
    if (!analytics?.openPositions?.length) return null;
    const positions = analytics.openPositions;

    const totalValue = positions.reduce((sum, pos) => sum + (pos.current_value || pos.current_price * pos.quantity), 0);
    const totalPnL = positions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);
    const avgReturn = positions.reduce((sum, pos) => sum + (pos.return_pct || 0), 0) / positions.length;

    const bestPosition = positions.reduce((best, pos) => {
      if (!best || (pos.pnl ?? 0) > (best.pnl ?? 0)) {
        return pos;
      }
      return best;
    }, null);

    const worstPosition = positions.reduce((worst, pos) => {
      if (!worst || (pos.pnl ?? 0) < (worst.pnl ?? 0)) {
        return pos;
      }
      return worst;
    }, null);

    return {
      totalValue,
      totalPnL,
      avgReturn,
      bestPosition,
      worstPosition,
      count: positions.length
    };
  }, [analytics]);

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
    return <EmptyState />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-blue-500 dark:text-blue-300">Analytics</p>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Advanced Portfolio Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Live metrics from your trading journal, automatically recalculated every refresh.
          </p>
        </div>
        <Button onClick={() => loadAnalytics(false)} disabled={refreshing} className="flex items-center gap-2">
          <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh insights
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <Card key={card.label} className="p-5">
            <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">{card.value}</p>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">{card.sublabel}</p>
              <TrendBadge value={card.trend} />
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Portfolio value over time</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(analytics.summary.totalPnL + analytics.summary.totalCapital)}
                </p>
              </div>
              <TrendBadge value={analytics.summary.totalPnL} />
            </div>
            <MiniAreaChart data={analytics.charts.equityCurve} />
          </div>
          <div className="w-full lg:w-72 space-y-4">
            <ExposureBar
              longExposure={analytics.summary.exposure?.long}
              shortExposure={analytics.summary.exposure?.short}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 p-4">
                <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Sharpe</p>
                <p className="text-2xl font-semibold text-emerald-900 dark:text-emerald-200 mt-1">
                  {analytics.insights.risk.sharpe_ratio}
                </p>
                <p className="text-[11px] text-emerald-800/70 dark:text-emerald-200/80 mt-1">Return vs. volatility</p>
              </div>
              <div className="rounded-2xl bg-slate-900 text-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-300">Max Drawdown</p>
                <p className="text-2xl font-semibold mt-1">{analytics.insights.risk.max_drawdown}%</p>
                <p className="text-[11px] text-slate-300/80 mt-1">From equity curve</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Asset Allocation</h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {analytics.charts.allocation.length} positions
            </span>
          </div>
          <DonutChart data={analytics.charts.allocation} />
        </Card>

        <Card className="p-6 col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Performance by Symbol</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">Top movers</span>
          </div>
          <div className="space-y-3">
            {analytics.charts.performanceBySymbol.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Not enough trades yet.</p>
            )}
            {analytics.charts.performanceBySymbol.map((item) => {
              const maxAbs = Math.max(
                ...analytics.charts.performanceBySymbol.map((el) => Math.abs(el.pnl) || 1)
              );
              const width = `${(Math.abs(item.pnl) / maxAbs) * 100}%`;
              const isPositive = item.pnl >= 0;
              return (
                <div key={item.symbol}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-900 dark:text-white">{item.symbol}</span>
                    <span className={isPositive ? 'text-emerald-500' : 'text-rose-500'}>
                      {formatCurrency(item.pnl)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full ${isPositive ? 'bg-emerald-500/80' : 'bg-rose-500/80'}`}
                      style={{ width }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6 col-span-1 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <TrophyIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Best & Worst Trades</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Most impactful executions</p>
            </div>
          </div>
          <div className="space-y-4">
            {['bestTrade', 'worstTrade'].map((key) => {
              const trade = analytics.insights[key];
              const label = key === 'bestTrade' ? 'Best trade' : 'Needs attention';
              const color =
                key === 'bestTrade'
                  ? 'border-emerald-100 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                  : 'border-rose-100 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10';

              if (!trade) {
                return (
                  <div key={key} className={`rounded-2xl border p-4 ${color}`}>
                    <p className="text-sm text-gray-500 dark:text-gray-400">No data yet</p>
                  </div>
                );
              }

              return (
                <div key={key} className={`rounded-2xl border p-4 ${color}`}>
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white mt-1">{trade.symbol}</p>
                  <p className={`text-sm ${trade.pnl >= 0 ? 'text-emerald-600' : 'text-rose-500'} mt-1`}>
                    {formatCurrency(trade.pnl)} ({formatPercent(trade.return_pct)})
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Qty {trade.quantity} • {trade.direction.toUpperCase()}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {portfolioSnapshot && (
        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Live Portfolio</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {portfolioSnapshot.count} active positions, updated with latest quotes
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Portfolio Value</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(portfolioSnapshot.totalValue)}
                </p>
              </div>
              <TrendBadge value={portfolioSnapshot.totalPnL} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 bg-gray-50/70 dark:bg-gray-800/40">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Average Return</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                {formatPercent(portfolioSnapshot.avgReturn)}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Across all open trades
              </p>
            </div>
            {[portfolioSnapshot.bestPosition, portfolioSnapshot.worstPosition].map((position, index) => {
              const label = index === 0 ? 'Top Performer' : 'Lagging Position';
              const accent =
                index === 0
                  ? 'border-emerald-100 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                  : 'border-rose-100 bg-rose-50/70 dark:border-rose-500/30 dark:bg-rose-500/10';

              if (!position) {
                return (
                  <div key={label} className={`rounded-2xl border p-4 ${accent}`}>
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Not enough data yet</p>
                  </div>
                );
              }

              return (
                <div key={label} className={`rounded-2xl border p-4 ${accent}`}>
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white mt-1">{position.symbol}</p>
                  <p className={`text-sm ${position.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'} mt-1`}>
                    {formatCurrency(position.pnl)} ({formatPercent(position.return_pct)})
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {position.quantity} shares • {position.direction.toUpperCase()}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Trades</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last {analytics.recentTrades.length} executions
            </p>
          </div>
          <div className="space-y-3">
            {analytics.recentTrades.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Log trades to see history.</p>
            )}
            {analytics.recentTrades.map((trade) => (
              <div
                key={`${trade.symbol}-${trade.trade_date}`}
                className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-800/60 px-3 py-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 dark:text-white">{trade.symbol}</p>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        trade.direction === 'long'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                      }`}
                    >
                      {trade.direction.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {trade.trade_date ? new Date(trade.trade_date).toLocaleDateString() : 'Date unknown'}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${trade.pnl >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {formatCurrency(trade.pnl)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatPercent(trade.return_pct)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Open Positions</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {analytics.openPositions.length} active trades
            </p>
          </div>
          {analytics.openPositions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No open trades at the moment.</p>
          ) : (
            <div className="space-y-3">
              {analytics.openPositions.map((position) => (
                <div
                  key={`${position.symbol}-${position.entry_price}`}
                  className="grid grid-cols-4 items-center gap-2 py-2 border-b border-gray-100 dark:border-gray-800"
                >
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{position.symbol}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{position.direction.toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Entry</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(position.entry_price)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Current</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(position.current_price)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${position.pnl >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {formatCurrency(position.pnl)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatPercent(position.return_pct)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Analysis;

