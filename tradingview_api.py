import requests
import json
import time
from typing import Dict, Optional, List

def fetch_stock_prices(symbols: List[str]) -> Dict[str, Optional[Dict]]:
    """
    Fetch live stock prices from TradingView Screener API
    
    Args:
        symbols: List of stock symbols to fetch prices for
        
    Returns:
        Dictionary mapping symbols to price data or None if failed
    """
    if not symbols:
        return {}
    
    # Prepare the request payload
    payload = {
        "symbols": {
            "tickers": []
        },
        "columns": [
            "price",
            "change",
            "change_abs",
            "volume"
        ],
        "range": [0, len(symbols)]
    }
    
    # Add symbols for different exchanges
    for symbol in symbols:
        payload["symbols"]["tickers"].extend([
            f"NASDAQ:{symbol}",
            f"NYSE:{symbol}",
            f"AMEX:{symbol}"
        ])
    
    try:
        # Make the request to TradingView
        response = requests.post(
            'https://scanner.tradingview.com/america/scan',
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            json=payload,
            timeout=10
        )
        
        if not response.ok:
            print(f"TradingView API error: HTTP {response.status} - {response.status_text}")
            return {symbol: None for symbol in symbols}
        
        data = response.json()
        print(f"TradingView API response: {data}")
        
        # Process the response
        results = {}
        if data.get('data'):
            # Create a mapping of symbols to their data
            symbol_data = {}
            for item in data['data']:
                # Extract symbol from ticker (e.g., "NASDAQ:AAPL" -> "AAPL")
                ticker = item.get('s', '')
                if ':' in ticker:
                    symbol = ticker.split(':')[1]
                    symbol_data[symbol] = item
            
            # Map results back to original symbols
            for symbol in symbols:
                if symbol in symbol_data:
                    item = symbol_data[symbol]
                    try:
                        current = float(item['d'][0])  # price
                        change = float(item['d'][1])   # change
                        change_percent = float(item['d'][2])  # change_abs
                        
                        results[symbol] = {
                            'current': current,
                            'change': change,
                            'changePercent': change_percent
                        }
                        print(f"✅ Fetched price for {symbol}: ${current} ({change_percent}%)")
                    except (IndexError, ValueError, KeyError) as e:
                        print(f"❌ Error parsing data for {symbol}: {e}")
                        results[symbol] = None
                else:
                    print(f"❌ No data found for {symbol}")
                    results[symbol] = None
        else:
            print("❌ No data in TradingView response")
            results = {symbol: None for symbol in symbols}
        
        return results
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Request error: {e}")
        return {symbol: None for symbol in symbols}
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error: {e}")
        return {symbol: None for symbol in symbols}
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return {symbol: None for symbol in symbols}

def fetch_single_stock_price(symbol: str) -> Optional[Dict]:
    """
    Fetch price for a single stock symbol
    
    Args:
        symbol: Stock symbol to fetch price for
        
    Returns:
        Price data dictionary or None if failed
    """
    results = fetch_stock_prices([symbol])
    return results.get(symbol)

# Test function
if __name__ == "__main__":
    # Test with some popular stocks
    test_symbols = ["AAPL", "MSFT", "GOOGL", "TSLA"]
    print("Testing TradingView API...")
    results = fetch_stock_prices(test_symbols)
    
    for symbol, data in results.items():
        if data:
            print(f"{symbol}: ${data['current']} ({data['changePercent']}%)")
        else:
            print(f"{symbol}: No data") 