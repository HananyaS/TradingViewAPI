import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { DocumentTextIcon, BookmarkIcon, ChartBarIcon } from '@heroicons/react/24/outline';

const Analysis = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 p-10 text-white shadow-2xl">
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <ChartBarIcon className="h-8 w-8 text-white" />
            <div>
              <p className="text-sm uppercase tracking-widest text-blue-200">Analysis Workspace</p>
              <h1 className="text-3xl font-bold">Your insights will live here</h1>
            </div>
          </div>
          <p className="text-blue-100 max-w-2xl">
            This page will visualize data pulled from your actual trades, saved filters, and watchlist activity.
            We removed the placeholder stats so everything you see will come directly from your usage.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/journal')} variant="secondary">
              <DocumentTextIcon className="h-5 w-5 mr-2" />
              Add trades to journal
            </Button>
            <Button onClick={() => navigate('/watchlist')} variant="outline" className="text-white border-white/30">
              <BookmarkIcon className="h-5 w-5 mr-2" />
              Manage watchlist
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border-2 border-dashed border-gray-200 dark:border-gray-700 text-center py-12">
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Real analytics unlock automatically</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Once you start saving filters, logging trades, and tracking symbols, we’ll aggregate that live data and surface win rates,
            risk metrics, and watchlist performance right here.
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Until then, there are no synthetic numbers—only your actual activity will populate this dashboard.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Analysis;

