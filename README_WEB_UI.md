# TradingView Screener Web UI

This is a beautiful web interface for the TradingView Screener that provides the same functionality as the Telegram bot but through a modern web interface.

## Features

- **Modern UI**: Beautiful, responsive design with gradient backgrounds and smooth animations
- **Easy Parameter Input**: Toggle buttons for boolean parameters and number inputs for numeric parameters
- **Real-time Results**: Get immediate feedback on your screener results
- **CSV Download**: Download your results as a CSV file
- **Preserved Functionality**: All existing functionality from the Telegram bot is preserved

## Installation

1. Install the required dependencies:
```bash
pip install -r requirements.txt
```

2. Run the web application:
```bash
python app.py
```

3. Open your browser and navigate to `http://localhost:5000`

## Usage

### Web Interface

1. **Access the Web UI**: Open `http://localhost:5000` in your browser
2. **Configure Parameters**: Use the form to set your screening criteria:
   - **US Exchanges Only**: Toggle between Yes/No
   - **Minimum Price**: Enter a minimum stock price (leave empty for no minimum)
   - **Minimum Relative Volume**: Enter minimum relative volume ratio
   - **Minimum % Change**: Enter minimum percentage change
   - **Minimum SMA20/Close Ratio**: Enter minimum SMA20 to close price ratio
   - **Minimum ATR %**: Enter minimum Average True Range percentage
   - **Minimum ADR %**: Enter minimum Average Daily Range percentage
   - **Filter Out OTC**: Toggle to exclude OTC exchanges
   - **Only Bullish Candlestick Patterns**: Toggle to filter for bullish patterns only

3. **Run Screener**: Click "Run Screener" to execute the query
4. **Download Results**: Click "Download CSV" to get your results as a CSV file

### API Endpoints

The web UI also provides REST API endpoints for programmatic access:

#### POST `/api/query`
Submit screener parameters and get results.

**Request Body:**
```json
{
  "us_exchanges_only": true,
  "min_price": 1.0,
  "min_relative_volume": 1.5,
  "min_change": 5.0,
  "min_sma20_above_pct": 1.1,
  "min_atr_pct": 5.0,
  "min_adr_pct": 3.0,
  "filter_out_otc": true,
  "bullish_candlestick_patterns_only": false
}
```

**Response:**
```json
{
  "success": true,
  "count": 150,
  "message": "Found 150 symbols!",
  "csv_data": "...",
  "filename": "screener_results_20241201.csv"
}
```

#### POST `/api/download`
Download CSV file from the server.

**Request Body:**
```json
{
  "csv_data": "...",
  "filename": "screener_results_20241201.csv"
}
```

## Parameters

All parameters match the original Telegram bot functionality:

- **us_exchanges_only** (boolean): Filter to US exchanges only
- **min_price** (float): Minimum stock price
- **min_relative_volume** (float): Minimum relative volume ratio
- **min_change** (float): Minimum percentage change (automatically converted to decimal)
- **min_sma20_above_pct** (float): Minimum SMA20 to close price ratio
- **min_atr_pct** (float): Minimum Average True Range percentage
- **min_adr_pct** (float): Minimum Average Daily Range percentage
- **filter_out_otc** (boolean): Exclude OTC exchanges
- **bullish_candlestick_patterns_only** (boolean): Filter for bullish candlestick patterns only

## Default Values

The web UI uses the same default values as the original bot:
- US Exchanges Only: `True`
- Minimum Price: `1`
- Minimum Relative Volume: `None`
- Minimum % Change: `None`
- Minimum SMA20/Close Ratio: `1.5`
- Minimum ATR %: `None`
- Minimum ADR %: `None`
- Filter Out OTC: `True`
- Only Bullish Candlestick Patterns: `False`

## Technical Details

- **Backend**: Flask web server
- **Frontend**: HTML5, CSS3, JavaScript with Bootstrap 5
- **API**: RESTful API endpoints
- **File Handling**: CSV generation and download functionality
- **CORS**: Enabled for cross-origin requests

## Preserved Functionality

The web UI preserves all existing functionality:
- ✅ All original parameters and their types
- ✅ Default parameter values
- ✅ Query logic and filtering
- ✅ CSV generation
- ✅ Error handling
- ✅ TradingView API integration

## Running Both Interfaces

You can run both the Telegram bot and the web UI simultaneously:

1. **Telegram Bot**: Use `python run_query.py` (uncomment the main_telegram() call)
2. **Web UI**: Use `python app.py`

Both interfaces use the same underlying `query_by_params()` function, ensuring consistent results.

## Troubleshooting

- **Port already in use**: Change the port in `app.py` line 89
- **CORS issues**: The app includes CORS support for cross-origin requests
- **CSV download issues**: Ensure your browser allows file downloads
- **No results found**: Try adjusting your parameters to be less restrictive 