import React, { createContext, useContext } from 'react';
import { useUnifiedNews } from '../hooks/useUnifiedNews';

const NewsContext = createContext(null);

export const NewsProvider = ({ children }) => {
  const newsData = useUnifiedNews();

  return (
    <NewsContext.Provider value={newsData}>
      {children}
    </NewsContext.Provider>
  );
};

export const useNews = () => {
  const context = useContext(NewsContext);
  if (!context) {
    throw new Error('useNews must be used within NewsProvider');
  }
  return context;
};

