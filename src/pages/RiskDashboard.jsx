import React, { useEffect, useState } from 'react';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { fetchWithAuth } from '../utils/api';
import {
  ExclamationTriangleIcon,
  ChartBarIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ShieldExclamationIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import HorizontalBarChart from '../components/charts/HorizontalBarChart';

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

const RiskDashboard = () => {
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadRiskData();
  }, []);

  const loadRiskData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchWithAuth('/api/analytics/risk');
      const data = await response.json();
      
      if (data.success) {
        setRiskData(data.data);
      } else {
        setError(data.error || 'Failed to load risk data');
      }
    } catch (err) {
      setError('Failed to fetch risk analytics');
      console.error('Error loading risk data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="p-6 max-w-md">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <ExclamationTriangleIcon className="h-6 w-6" />
            <div>
              <h3 className="font-semibold">Error Loading Risk Data</h3>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!riskData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500 dark:text-gray-400">No risk data available</p>
      </div>
    );
  }

  const { riskMetrics, concentration, correlation, leverage, alerts } = riskData;

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-300 dark:border-red-800';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-800';
      default:
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800';
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'concentration':
      case 'leverage':
      case 'drawdown':
        return <ShieldExclamationIcon className="h-5 w-5" />;
      default:
        return <InformationCircleIcon className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Risk Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Comprehensive risk analysis and monitoring
          </p>
        </div>
      </div>

      {/* Risk Alerts */}
      {alerts && alerts.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Risk Alerts</h2>
          </div>
          <div className="space-y-2">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex items-start gap-2">
                  {getAlertIcon(alert.type)}
                  <p className="text-sm font-medium">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Risk Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Value at Risk (95%)</span>
            <ArrowTrendingDownIcon className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatPercent(-riskMetrics.var_95)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Maximum expected loss
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Conditional VaR (95%)</span>
            <ArrowTrendingDownIcon className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatPercent(-riskMetrics.cvar_95)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Expected loss beyond VaR
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Max Drawdown</span>
            <ArrowTrendingDownIcon className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatPercent(-riskMetrics.maxDrawdown)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Largest peak-to-trough decline
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Volatility</span>
            <ChartBarIcon className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatPercent(riskMetrics.volatility)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Portfolio volatility
          </p>
        </Card>
      </div>

      {/* Risk-Adjusted Returns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Sharpe Ratio</span>
            <ArrowTrendingUpIcon className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {riskMetrics.sharpeRatio.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Risk-adjusted return metric
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Sortino Ratio</span>
            <ArrowTrendingUpIcon className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {riskMetrics.sortinoRatio.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Downside risk-adjusted return
          </p>
        </Card>
      </div>

      {/* Concentration Risk */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Concentration Risk
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Top Stock Exposure</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatPercent(concentration.topStockExposure)}
            </p>
            {concentration.topStockSymbol && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {concentration.topStockSymbol}
              </p>
            )}
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Top 5 Stocks</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatPercent(concentration.top5StockExposure)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Combined exposure
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Positions</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {concentration.stockBreakdown?.length || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Unique symbols
            </p>
          </div>
        </div>
        {concentration.stockBreakdown && concentration.stockBreakdown.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Stock Allocation
            </h3>
            <HorizontalBarChart
              data={concentration.stockBreakdown.map((item) => ({
                label: item.symbol,
                count: item.percent,
                value: item.percent
              }))}
              height={300}
              barColor="#8b5cf6"
              showValues={true}
            />
          </div>
        )}
      </Card>

      {/* Leverage Monitoring */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Leverage Monitoring
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Leverage Ratio</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {leverage.leverageRatio.toFixed(2)}x
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Gross exposure / Portfolio value
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Long Exposure</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(leverage.longExposure)}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Short Exposure</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(leverage.shortExposure)}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Gross Exposure</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(leverage.grossExposure)}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Net Exposure</p>
            <p className={`text-2xl font-bold ${
              leverage.netExposure >= 0 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatCurrency(leverage.netExposure)}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Exposure</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(leverage.totalExposure)}
            </p>
          </div>
        </div>
      </Card>

      {/* Correlation Risk */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Correlation Analysis
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Average Correlation</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {correlation.avgCorrelation.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Portfolio correlation
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">High Correlation Pairs</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {correlation.highCorrelationPairs?.length || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Pairs with correlation &gt; 0.7
            </p>
          </div>
        </div>
        {correlation.highCorrelationPairs && correlation.highCorrelationPairs.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              High Correlation Pairs
            </h3>
            <div className="space-y-2">
              {correlation.highCorrelationPairs.map((pair, index) => (
                <div
                  key={index}
                  className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {pair.symbol1} ↔ {pair.symbol2}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Correlation: {pair.correlation.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default RiskDashboard;

