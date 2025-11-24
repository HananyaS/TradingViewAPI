import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import NewsSection from '../components/NewsSection';
import { useNews } from '../contexts/NewsContext';
import {
  NewspaperIcon
} from '@heroicons/react/24/outline';

const News = () => {
  const { theme } = useTheme();

  const storyTypes = [
    { value: 'curated', label: 'Curated News', description: 'Top financial and technology news sources' },
    { value: 'market', label: 'Market News', description: 'Stock market news and updates' },
    { value: 'sec_fin', label: 'SEC Financial Reports', description: 'Quarterly and annual financial reports' },
    { value: 'trade', label: 'Trading News', description: 'Trading-related news and updates' },
    { value: 'analysis', label: 'Stock Analysis', description: 'In-depth stock analysis articles' }
  ];

  // Get unified news data
  const { allNews } = useNews();
  
  // Extract story type news from unified data
  const storyTypeNews = allNews?.storyTypes || {};

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center">
          <NewspaperIcon className="h-6 w-6 sm:h-8 sm:w-8 mr-2 sm:mr-3 text-blue-600 dark:text-blue-400" />
          Market News
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 sm:mt-2 text-sm sm:text-base">
          Stay updated with the latest news from US stock markets
        </p>
      </div>

      {/* Story Type News Sections */}
      <div className="space-y-6">
        {storyTypes.map((storyTypeConfig) => (
          <NewsSection
            key={storyTypeConfig.value}
            symbols={[]} // Empty symbols - will use story_type instead
            title={storyTypeConfig.label}
            maxStories={30}
            showTickerSelection={false}
            showStoryTypes={false}
            autoRefresh={false} // Batch hook handles refresh
            storyType={storyTypeConfig.value}
            preloadedStories={storyTypeNews[storyTypeConfig.value] || null}
            allowApiFetch={false}
          />
        ))}
      </div>
    </div>
  );
};

export default News;

