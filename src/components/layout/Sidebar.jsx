import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  BookmarkIcon,
  DocumentTextIcon,
  ChartBarIcon,
  NewspaperIcon,
  BellIcon,
  XMarkIcon,
  ShieldExclamationIcon,
  ArrowsRightLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  BriefcaseIcon,
  ChartPieIcon
} from '@heroicons/react/24/outline';

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const [expandedCategories, setExpandedCategories] = useState({
    trading: false,
    portfolio: false,
    analytics: false,
    alerts: false
  });

  const navigationCategories = [
    {
      id: 'trading',
      name: 'Trading & Research',
      icon: MagnifyingGlassIcon,
      items: [
        { name: 'Strategies', href: '/', icon: HomeIcon },
        { name: 'Watchlist', href: '/watchlist', icon: BookmarkIcon },
        { name: 'News', href: '/news', icon: NewspaperIcon },
      ]
    },
    {
      id: 'portfolio',
      name: 'Portfolio Management',
      icon: BriefcaseIcon,
      items: [
        { name: 'Journal', href: '/journal', icon: DocumentTextIcon },
        { name: 'Rebalancing', href: '/rebalancing', icon: ArrowsRightLeftIcon },
        { name: 'Risk Dashboard', href: '/risk', icon: ShieldExclamationIcon },
      ]
    },
    {
      id: 'analytics',
      name: 'Analytics',
      icon: ChartPieIcon,
      items: [
        { name: 'Analysis', href: '/analysis', icon: ChartBarIcon },
      ]
    },
    {
      id: 'alerts',
      name: 'Alerts & Notifications',
      icon: BellIcon,
      items: [
        { name: 'Alerts', href: '/alerts', icon: BellIcon },
      ]
    }
  ];

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const isActive = (href) => {
    return location.pathname === href;
  };

  const isCategoryActive = (items) => {
    return items.some(item => isActive(item.href));
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={onClose}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-40 h-screen
          w-64 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 
          border-r border-gray-200/50 dark:border-gray-700/50 shadow-lg
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Mobile close button */}
          <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
            <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Trading App
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigationCategories.map((category) => {
              const isExpanded = expandedCategories[category.id];
              const hasActiveItem = isCategoryActive(category.items);
              const CategoryIcon = category.icon;

              return (
                <div key={category.id} className="mb-1">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2.5 rounded-xl
                      transition-all duration-200 group relative
                      ${hasActiveItem
                        ? 'bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20 text-blue-700 dark:text-blue-300 shadow-sm'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-700/50'
                      }
                    `}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className={`
                        p-1.5 rounded-lg transition-colors
                        ${hasActiveItem
                          ? 'bg-blue-100 dark:bg-blue-900/50'
                          : 'bg-gray-100 dark:bg-gray-700/50 group-hover:bg-gray-200 dark:group-hover:bg-gray-600/50'
                        }
                      `}>
                        <CategoryIcon className={`h-4 w-4 ${
                          hasActiveItem
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-400'
                        }`} />
                      </div>
                      <span className={`text-sm font-semibold ${
                        hasActiveItem
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {category.name}
                      </span>
                    </div>
                    <div className={`
                      transition-transform duration-200
                      ${isExpanded ? 'rotate-0' : '-rotate-90'}
                    `}>
                      {isExpanded ? (
                        <ChevronDownIcon className={`h-4 w-4 ${
                          hasActiveItem
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`} />
                      ) : (
                        <ChevronRightIcon className={`h-4 w-4 ${
                          hasActiveItem
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`} />
                      )}
                    </div>
                  </button>

                  {/* Category Items */}
                  {isExpanded && (
                    <div className="ml-2 mt-1.5 space-y-0.5 pl-4 border-l-2 border-gray-200/60 dark:border-gray-700/60">
                      {category.items.map((item) => {
                        const active = isActive(item.href);
                        const ItemIcon = item.icon;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            onClick={() => {
                              // Close mobile menu on navigation
                              if (window.innerWidth < 1024) {
                                onClose();
                              }
                            }}
                            className={`
                              flex items-center space-x-2.5 px-3 py-2 rounded-lg
                              transition-all duration-200 group relative
                              ${active
                                ? 'bg-gradient-to-r from-blue-50 to-blue-100/30 dark:from-blue-900/20 dark:to-blue-800/10 text-blue-700 dark:text-blue-300 font-medium shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/60 dark:hover:bg-gray-700/30 hover:text-gray-900 dark:hover:text-gray-200'
                              }
                            `}
                          >
                            {active && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 rounded-r-full"></div>
                            )}
                            <ItemIcon
                              className={`h-4 w-4 transition-colors ${
                                active
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                              }`}
                            />
                            <span className="text-sm flex-1">{item.name}</span>
                            {active && (
                              <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shadow-sm"></div>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm">
            <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1.5">
                Need Help?
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                Check out our documentation and tutorials
              </p>
              <a
                href="#"
                className="inline-flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors group"
              >
                View Docs
                <span className="ml-1 group-hover:translate-x-0.5 transition-transform">→</span>
              </a>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

