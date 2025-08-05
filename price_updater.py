import threading
import time
from datetime import datetime, timedelta
from typing import List, Dict, Set
import requests
import json
from mongodb_config import mongodb_manager
from tradingview_api import fetch_stock_prices

class PriceUpdater:
    def __init__(self):
        self.running = False
        self.thread = None
        self.update_interval = 30  # seconds
        self.last_update = None
        self.stats = {
            'total_updates': 0,
            'last_update_time': None,
            'symbols_updated': 0,
            'errors': 0
        }
    
    def start(self):
        """Start the background price updater thread"""
        if self.running:
            print("Price updater is already running")
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
        print("✅ Background price updater started")
    
    def stop(self):
        """Stop the background price updater thread"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        print("✅ Background price updater stopped")
    
    def _run(self):
        """Main loop for the background price updater"""
        print("🔄 Price updater thread started")
        
        while self.running:
            try:
                self._update_all_prices()
                time.sleep(self.update_interval)
            except Exception as e:
                print(f"❌ Error in price updater thread: {e}")
                self.stats['errors'] += 1
                time.sleep(60)  # Wait longer on error
    
    def _get_all_watched_symbols(self) -> Set[str]:
        """Get all unique symbols from all MongoDB tables"""
        symbols = set()
        
        try:
            # Get symbols from screeners
            screeners = mongodb_manager.get_all_screeners()
            for screener in screeners:
                if 'params' in screener and 'symbols' in screener['params']:
                    screener_symbols = screener['params']['symbols']
                    if isinstance(screener_symbols, str):
                        # Parse comma-separated symbols
                        symbols.update([s.strip().upper() for s in screener_symbols.split(',') if s.strip()])
                    elif isinstance(screener_symbols, list):
                        symbols.update([s.upper() for s in screener_symbols if s])
            
            # Get symbols from price cache (already watched)
            if mongodb_manager.client:
                price_collection = mongodb_manager.db.price_cache
                cached_symbols = price_collection.distinct('symbol')
                symbols.update(cached_symbols)
            
            # Get symbols from user trades (if we had user trades in MongoDB)
            # For now, we'll add some common symbols that users typically trade
            common_symbols = [
                'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX',
                'AMD', 'INTC', 'CRM', 'ADBE', 'PYPL', 'NKE', 'DIS', 'JPM',
                'V', 'WMT', 'PG', 'JNJ', 'UNH', 'HD', 'MA', 'BAC', 'PFE',
                'ABT', 'KO', 'PEP', 'TMO', 'ABBV', 'MRK', 'AVGO', 'COST',
                'ACN', 'DHR', 'NEE', 'LLY', 'TXN', 'UNP', 'RTX', 'HON',
                'QCOM', 'LOW', 'UPS', 'IBM', 'CAT', 'SPGI', 'GS', 'MS',
                'AMGN', 'ISRG', 'GILD', 'T', 'DE', 'PLD', 'ADI', 'CME'
            ]
            symbols.update(common_symbols)
            
            print(f"📊 Found {len(symbols)} unique symbols to watch")
            return symbols
            
        except Exception as e:
            print(f"❌ Error getting watched symbols: {e}")
            return set()
    
    def _update_all_prices(self):
        """Update prices for all watched symbols"""
        try:
            symbols = self._get_all_watched_symbols()
            if not symbols:
                print("⚠️ No symbols to update")
                return
            
            print(f"🔄 Updating prices for {len(symbols)} symbols...")
            
            # Convert set to list for API call
            symbol_list = list(symbols)
            
            # Fetch live prices from TradingView
            live_prices = fetch_stock_prices(symbol_list)
            
            # Update MongoDB cache with live prices
            updated_count = 0
            for symbol, price_data in live_prices.items():
                if price_data:
                    try:
                        mongodb_manager.update_price_cache(
                            symbol=symbol,
                            current_price=price_data['current'],
                            change=price_data['change'],
                            change_percent=price_data['changePercent']
                        )
                        updated_count += 1
                    except Exception as e:
                        print(f"❌ Error updating cache for {symbol}: {e}")
            
            # Update stats
            self.stats['total_updates'] += 1
            self.stats['last_update_time'] = datetime.utcnow()
            self.stats['symbols_updated'] = updated_count
            
            print(f"✅ Updated {updated_count}/{len(symbols)} symbols")
            
            # Clean up old cache entries (older than 24 hours)
            if self.stats['total_updates'] % 48 == 0:  # Every 24 minutes (48 * 30 seconds)
                mongodb_manager.clear_old_price_cache(hours=24)
                
        except Exception as e:
            print(f"❌ Error updating all prices: {e}")
            self.stats['errors'] += 1
    
    def get_stats(self) -> Dict:
        """Get current statistics"""
        return {
            **self.stats,
            'running': self.running,
            'update_interval': self.update_interval
        }
    
    def set_update_interval(self, seconds: int):
        """Set the update interval"""
        self.update_interval = max(10, seconds)  # Minimum 10 seconds
        print(f"⏱️ Price update interval set to {self.update_interval} seconds")

# Global price updater instance
price_updater = PriceUpdater()

def start_price_updater():
    """Start the background price updater"""
    price_updater.start()

def stop_price_updater():
    """Stop the background price updater"""
    price_updater.stop()

def get_price_updater_stats():
    """Get price updater statistics"""
    return price_updater.get_stats()

def set_price_update_interval(seconds: int):
    """Set the price update interval"""
    price_updater.set_update_interval(seconds)

# Test function
if __name__ == "__main__":
    print("Testing price updater...")
    
    # Start the updater
    start_price_updater()
    
    try:
        # Run for 2 minutes to test
        for i in range(4):  # 4 * 30 seconds = 2 minutes
            time.sleep(30)
            stats = get_price_updater_stats()
            print(f"Stats: {stats}")
    except KeyboardInterrupt:
        print("\nStopping price updater...")
    finally:
        stop_price_updater()
        print("Price updater test completed") 